import { z } from 'zod';
import {
  DataLoader,
  DatabaseRecord,
  DatabaseMetadata,
  SplitMetadata,
  DatabaseIndex,
} from './data-loader.js';

// Query types and enums
export enum QueryOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  GREATER_THAN_OR_EQUAL = 'GREATER_THAN_OR_EQUAL',
  LESS_THAN_OR_EQUAL = 'LESS_THAN_OR_EQUAL',
  IN = 'IN',
  CONTAINS = 'CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
}

export interface QueryFilter {
  field: string;
  operator: QueryOperator;
  value: any;
}

export interface QuerySort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sort?: QuerySort[];
}

export interface QueryResult<T = DatabaseRecord> {
  records: T[];
  totalCount: number;
  hasMore: boolean;
  executionTime: number;
}

/**
 * Core query engine that handles all database operations
 * Environment-agnostic - uses DataLoader for I/O operations
 */
export class QueryEngine {
  private metadata?: DatabaseMetadata;
  private splitMetadata?: SplitMetadata;
  private indexCache = new Map<string, DatabaseIndex | any>();
  private recordCache = new Map<string, DatabaseRecord>();
  private schema?: z.ZodSchema;
  private initialized = false;

  constructor(private dataLoader: DataLoader) {}

  /**
   * Initialize the query engine by loading metadata
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([this.loadMetadata(), this.loadSchema()]);

    this.initialized = true;
  }

  /**
   * Ensure the engine is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Load metadata from data loader
   */
  private async loadMetadata(): Promise<void> {
    try {
      [this.metadata, this.splitMetadata] = await Promise.all([
        this.dataLoader.loadMetadata(),
        this.dataLoader.loadSplitMetadata(),
      ]);
    } catch (error) {
      throw new Error(`Failed to load metadata: ${error}`);
    }
  }

  /**
   * Load schema from data loader (optional)
   */
  private async loadSchema(): Promise<void> {
    try {
      this.schema = await this.dataLoader.loadSchema();
    } catch (error) {
      // Schema loading is optional
      console.warn('Could not load schema for validation');
    }
  }

  /**
   * Execute a query with filters and options
   */
  async executeQuery<T = DatabaseRecord>(
    filters: QueryFilter[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    await this.ensureInitialized();

    let candidateIds: Set<string> | null = null;

    // Apply filters using indexes where possible
    for (const filter of filters) {
      const filterIds = await this.getRecordIdsForFilter(filter);

      if (candidateIds === null) {
        candidateIds = filterIds;
      } else {
        // Intersect with previous results
        const intersection = new Set<string>();
        for (const id of candidateIds) {
          if (filterIds.has(id)) {
            intersection.add(id);
          }
        }
        candidateIds = intersection;
      }

      // Early exit if no candidates remain
      if (candidateIds.size === 0) {
        break;
      }
    }

    // If no filters were applied, get all record IDs
    if (candidateIds === null) {
      candidateIds = await this.getAllRecordIds();
    }

    // Load records
    const records: T[] = [];
    for (const id of candidateIds) {
      const record = await this.loadRecord(id);
      if (record) {
        // Apply additional filtering for complex filters not handled by indexes
        if (this.recordMatchesFilters(record, filters)) {
          records.push(record as T);
        }
      }
    }

    // Apply sorting
    if (options.sort && options.sort.length > 0) {
      this.applySorting(records, options.sort);
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit;
    const totalRecords = records.length;
    const paginatedRecords = limit ? records.slice(offset, offset + limit) : records.slice(offset);
    const hasMore = limit ? offset + limit < totalRecords : false;

    const endTime = Date.now();

    return {
      records: paginatedRecords,
      totalCount: totalRecords,
      hasMore,
      executionTime: endTime - startTime,
    };
  }

  /**
   * Get a single record by ID
   */
  async getRecord<T = DatabaseRecord>(id: string): Promise<T | null> {
    await this.ensureInitialized();
    return (await this.loadRecord(id)) as T | null;
  }

  /**
   * Get all records with optional limit
   */
  async getAllRecords<T = DatabaseRecord>(limit?: number): Promise<T[]> {
    const result = await this.executeQuery<T>([], { limit });
    return result.records;
  }

  /**
   * Get database metadata
   */
  async getMetadata(): Promise<DatabaseMetadata | undefined> {
    await this.ensureInitialized();
    return this.metadata;
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<DatabaseMetadata | undefined> {
    return this.getMetadata();
  }

  /**
   * Count total records
   */
  async count(): Promise<number> {
    await this.ensureInitialized();
    return this.metadata?.totalRecords || 0;
  }

  /**
   * Get all available fields
   */
  async getFields(): Promise<string[]> {
    await this.ensureInitialized();
    return this.metadata?.fields || [];
  }

  /**
   * Get indexed fields
   */
  async getIndexedFields(): Promise<string[]> {
    await this.ensureInitialized();
    return this.metadata?.indexes.map(idx => idx.field) || [];
  }

  // Private helper methods for query execution

  private async getRecordIdsForFilter(filter: QueryFilter): Promise<Set<string>> {
    try {
      // Try to use index first
      return await this.getRecordIdsFromIndex(filter);
    } catch (error) {
      // Fall back to scanning records
      console.warn(`Index lookup failed for field ${filter.field}, falling back to scan`);
      return await this.scanRecordsForFilter(filter);
    }
  }

  private async getRecordIdsFromIndex(filter: QueryFilter): Promise<Set<string>> {
    const index = await this.loadIndex(filter.field);
    if (!index) {
      throw new Error(`No index found for field: ${filter.field}`);
    }

    const resultIds = new Set<string>();

    // Handle different index formats (old vs new)
    if (index.entries && Array.isArray(index.entries)) {
      // New format with entries array
      for (const entry of index.entries) {
        let matches = false;

        switch (filter.operator) {
          case QueryOperator.EQUALS:
            matches = entry.value === filter.value;
            break;
          case QueryOperator.NOT_EQUALS:
            matches = entry.value !== filter.value;
            break;
          case QueryOperator.GREATER_THAN:
            matches = entry.value > filter.value;
            break;
          case QueryOperator.LESS_THAN:
            matches = entry.value < filter.value;
            break;
          case QueryOperator.GREATER_THAN_OR_EQUAL:
            matches = entry.value >= filter.value;
            break;
          case QueryOperator.LESS_THAN_OR_EQUAL:
            matches = entry.value <= filter.value;
            break;
          case QueryOperator.IN:
            matches = Array.isArray(filter.value) && filter.value.includes(entry.value);
            break;
          case QueryOperator.CONTAINS:
            if (Array.isArray(entry.value)) {
              matches = entry.value.includes(filter.value);
            } else {
              matches =
                typeof entry.value === 'string' &&
                typeof filter.value === 'string' &&
                entry.value.includes(filter.value);
            }
            break;
          case QueryOperator.STARTS_WITH:
            matches =
              typeof entry.value === 'string' &&
              typeof filter.value === 'string' &&
              entry.value.startsWith(filter.value);
            break;
          case QueryOperator.ENDS_WITH:
            matches =
              typeof entry.value === 'string' &&
              typeof filter.value === 'string' &&
              entry.value.endsWith(filter.value);
            break;
        }

        if (matches) {
          entry.recordIds.forEach((id: string) => resultIds.add(id));
        }
      }
    } else {
      // Old format - simple key-value mapping
      if (filter.operator === QueryOperator.EQUALS) {
        const recordIds = index[String(filter.value)] || [];
        if (Array.isArray(recordIds)) {
          recordIds.forEach((id: string) => resultIds.add(id));
        }
      }
    }

    return resultIds;
  }

  private async scanRecordsForFilter(filter: QueryFilter): Promise<Set<string>> {
    // This is less efficient but necessary for non-indexed fields
    const allIds = await this.getAllRecordIds();
    const resultIds = new Set<string>();

    for (const id of allIds) {
      const record = await this.loadRecord(id);
      if (record && this.recordMatchesFilter(record, filter)) {
        resultIds.add(id);
      }
    }

    return resultIds;
  }

  private recordMatchesFilters(record: DatabaseRecord, filters: QueryFilter[]): boolean {
    return filters.every(filter => this.recordMatchesFilter(record, filter));
  }

  private recordMatchesFilter(record: DatabaseRecord, filter: QueryFilter): boolean {
    const value = this.getNestedValue(record, filter.field);

    switch (filter.operator) {
      case QueryOperator.EQUALS:
        return value === filter.value;
      case QueryOperator.NOT_EQUALS:
        return value !== filter.value;
      case QueryOperator.GREATER_THAN:
        return value > filter.value;
      case QueryOperator.LESS_THAN:
        return value < filter.value;
      case QueryOperator.GREATER_THAN_OR_EQUAL:
        return value >= filter.value;
      case QueryOperator.LESS_THAN_OR_EQUAL:
        return value <= filter.value;
      case QueryOperator.IN:
        return Array.isArray(filter.value) && filter.value.includes(value);
      case QueryOperator.CONTAINS:
        if (Array.isArray(value)) {
          return value.includes(filter.value);
        }
        return (
          typeof value === 'string' &&
          typeof filter.value === 'string' &&
          value.includes(filter.value)
        );
      case QueryOperator.STARTS_WITH:
        return (
          typeof value === 'string' &&
          typeof filter.value === 'string' &&
          value.startsWith(filter.value)
        );
      case QueryOperator.ENDS_WITH:
        return (
          typeof value === 'string' &&
          typeof filter.value === 'string' &&
          value.endsWith(filter.value)
        );
      default:
        return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  private applySorting<T>(records: T[], sortOptions: QuerySort[]): void {
    records.sort((a, b) => {
      for (const sortOption of sortOptions) {
        const aVal = this.getNestedValue(a, sortOption.field);
        const bVal = this.getNestedValue(b, sortOption.field);

        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        else if (aVal > bVal) comparison = 1;

        if (comparison !== 0) {
          return sortOption.direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  private async loadIndex(field: string): Promise<DatabaseIndex | any | null> {
    if (this.indexCache.has(field)) {
      return this.indexCache.get(field)!;
    }

    try {
      const indexData = await this.dataLoader.loadIndex(field);
      if (indexData) {
        this.indexCache.set(field, indexData);
      }
      return indexData;
    } catch (error) {
      console.warn(`Failed to load index for field ${field}:`, error);
      return null;
    }
  }

  private async loadRecord(recordId: string): Promise<DatabaseRecord | null> {
    if (this.recordCache.has(recordId)) {
      return this.recordCache.get(recordId)!;
    }

    // Find which file contains this record
    const fileInfo = this.splitMetadata!.files.find(file => file.recordIds.includes(recordId));

    if (!fileInfo) {
      return null;
    }

    try {
      const record = await this.dataLoader.loadRecord(recordId, fileInfo, this.splitMetadata!);

      if (record) {
        this.recordCache.set(recordId, record);
      }

      return record;
    } catch (error) {
      console.error(`Failed to load record ${recordId}:`, error);
      return null;
    }
  }

  private async getAllRecordIds(): Promise<Set<string>> {
    // Use primary key index to get all record IDs efficiently
    const primaryIndex = await this.dataLoader.loadPrimaryIndex();
    const allIds = new Set<string>();

    if (primaryIndex.entries && Array.isArray(primaryIndex.entries)) {
      // New format
      primaryIndex.entries.forEach((entry: any) => {
        allIds.add(entry.id);
      });
    } else {
      // Old format - keys are the IDs
      Object.keys(primaryIndex).forEach(id => allIds.add(id));
    }

    return allIds;
  }
}
