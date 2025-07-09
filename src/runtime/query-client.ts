import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

export interface DatabaseRecord {
  [key: string]: any;
}

export interface DatabaseIndex {
  field: string;
  entries: Array<{
    value: any;
    recordIds: string[];
  }>;
  metadata: {
    uniqueValues: number;
    totalRecords: number;
    coverage: number;
  };
}

export interface DatabaseMetadata {
  totalRecords: number;
  indexes: Array<{
    field: string;
    type: 'primitive' | 'array' | 'nested';
    uniqueValues: number;
    coverage: number;
  }>;
  fields: string[];
  createdAt: string;
  version: string;
}

export interface SplitMetadata {
  totalRecords: number;
  totalFiles: number;
  avgFileSize: number;
  primaryKeyField: string;
  batchSize: number;
  useSubdirectories: boolean;
  files: Array<{
    filename: string;
    recordCount: number;
    size: number;
    recordIds: string[];
    subdirectory?: string;
  }>;
}

// Enum for operators - type-safe and tree-shakeable
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
 * Field-specific query builder for fluent API
 */
export class FieldQueryBuilder<T = DatabaseRecord> {
  constructor(
    private field: string,
    private parentBuilder: QueryBuilder<T>
  ) {}

  equals(value: any): QueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.EQUALS, value);
  }

  notEquals(value: any): QueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.NOT_EQUALS, value);
  }

  greaterThan(value: any): QueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.GREATER_THAN, value);
  }

  lessThan(value: any): QueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.LESS_THAN, value);
  }

  greaterThanOrEqual(value: any): QueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.GREATER_THAN_OR_EQUAL, value);
  }

  lessThanOrEqual(value: any): QueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.LESS_THAN_OR_EQUAL, value);
  }

  in(values: any[]): QueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.IN, values);
  }

  contains(value: any): QueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.CONTAINS, value);
  }

  startsWith(value: string): QueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.STARTS_WITH, value);
  }

  endsWith(value: string): QueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.ENDS_WITH, value);
  }

  // Aliases for common operations
  gt = this.greaterThan;
  lt = this.lessThan;
  gte = this.greaterThanOrEqual;
  lte = this.lessThanOrEqual;
  eq = this.equals;
  ne = this.notEquals;
}

export class QueryBuilder<T = DatabaseRecord> {
  private filters: QueryFilter[] = [];
  private sortOptions: QuerySort[] = [];
  private limitValue?: number;
  private offsetValue?: number;

  constructor(private client: AntipatternDB) {}

  // Fluent API method
  where(field: string): FieldQueryBuilder<T> {
    return new FieldQueryBuilder(field, this);
  }

  // Legacy method for backward compatibility (with enum)
  whereRaw(field: string, operator: QueryOperator, value: any): QueryBuilder<T> {
    return this.addFilter(field, operator, value);
  }

  // Simple equality method for convenience
  whereEquals(field: string, value: any): QueryBuilder<T> {
    return this.addFilter(field, QueryOperator.EQUALS, value);
  }

  // Internal method to add filters
  addFilter(field: string, operator: QueryOperator, value: any): QueryBuilder<T> {
    this.filters.push({ field, operator, value });
    return this;
  }

  sort(field: string, direction: 'asc' | 'desc' = 'asc'): QueryBuilder<T> {
    this.sortOptions.push({ field, direction });
    return this;
  }

  limit(count: number): QueryBuilder<T> {
    this.limitValue = count;
    return this;
  }

  offset(count: number): QueryBuilder<T> {
    this.offsetValue = count;
    return this;
  }

  async exec(): Promise<QueryResult<T>> {
    return this.client._executeQuery(this.filters, {
      limit: this.limitValue,
      offset: this.offsetValue,
      sort: this.sortOptions,
    });
  }
}

export class AntipatternDB {
  private databaseDir: string;
  private metadata?: DatabaseMetadata;
  private splitMetadata?: SplitMetadata;
  private indexCache = new Map<string, DatabaseIndex>();
  private recordCache = new Map<string, DatabaseRecord>();
  private schema?: z.ZodSchema;

  constructor(databaseDir: string) {
    this.databaseDir = path.resolve(databaseDir);

    if (!fs.existsSync(this.databaseDir)) {
      throw new Error(`Database directory not found: ${this.databaseDir}`);
    }
  }

  async init(): Promise<void> {
    await this.loadMetadata();
    await this.loadSchema();
  }

  private async loadMetadata(): Promise<void> {
    try {
      const metadataPath = path.join(this.databaseDir, 'metadata.json');
      const splitMetadataPath = path.join(this.databaseDir, 'split-metadata.json');

      if (!fs.existsSync(metadataPath) || !fs.existsSync(splitMetadataPath)) {
        throw new Error('Database metadata files not found');
      }

      this.metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      this.splitMetadata = JSON.parse(fs.readFileSync(splitMetadataPath, 'utf8'));
    } catch (error) {
      throw new Error(`Failed to load metadata: ${error}`);
    }
  }

  private async loadSchema(): Promise<void> {
    try {
      const schemaPath = path.join(this.databaseDir, 'schema.ts');
      if (fs.existsSync(schemaPath)) {
        // For now, we'll skip dynamic schema loading since it requires compilation
        // Users can import the schema directly from the generated files
        // This is a simplified version that works with the generated structure
      }
    } catch (error) {
      // Schema loading is optional
      console.warn('Could not load schema for validation');
    }
  }

  query<T = DatabaseRecord>(): QueryBuilder<T> {
    if (!this.metadata) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return new QueryBuilder<T>(this);
  }

  async get<T = DatabaseRecord>(id: string): Promise<T | null> {
    if (!this.metadata || !this.splitMetadata) {
      throw new Error('Database not initialized. Call init() first.');
    }

    // Check cache first
    if (this.recordCache.has(id)) {
      return this.recordCache.get(id) as T;
    }

    // Use primary key index to find the record
    const primaryIndex = await this.loadPrimaryIndex();
    const recordEntry = primaryIndex.entries.find((entry: any) => entry.id === id);

    if (!recordEntry) {
      return null;
    }

    // Load the record from the appropriate file
    const record = await this.loadRecord(id);
    if (record) {
      this.recordCache.set(id, record);
      return record as T;
    }

    return null;
  }

  async _executeQuery<T = DatabaseRecord>(
    filters: QueryFilter[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();

    if (!this.metadata || !this.splitMetadata) {
      throw new Error('Database not initialized. Call init() first.');
    }

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
      records.sort((a, b) => {
        for (const sortOption of options.sort!) {
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

    const totalCount = records.length;

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit;

    let paginatedRecords = records.slice(offset);
    if (limit) {
      paginatedRecords = paginatedRecords.slice(0, limit);
    }

    const executionTime = Date.now() - startTime;

    return {
      records: paginatedRecords,
      totalCount,
      hasMore: limit ? offset + limit < totalCount : false,
      executionTime,
    };
  }

  private async getRecordIdsForFilter(filter: QueryFilter): Promise<Set<string>> {
    const indexedFields = this.metadata!.indexes.map(idx => idx.field);

    if (indexedFields.includes(filter.field)) {
      return this.getRecordIdsFromIndex(filter);
    } else {
      // Field is not indexed, need to scan all records (less efficient)
      return this.scanRecordsForFilter(filter);
    }
  }

  private async getRecordIdsFromIndex(filter: QueryFilter): Promise<Set<string>> {
    const index = await this.loadIndex(filter.field);
    const resultIds = new Set<string>();

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
          matches =
            typeof entry.value === 'string' &&
            typeof filter.value === 'string' &&
            entry.value.includes(filter.value);
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
        entry.recordIds.forEach(id => resultIds.add(id));
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

  private async loadIndex(field: string): Promise<DatabaseIndex> {
    if (this.indexCache.has(field)) {
      return this.indexCache.get(field)!;
    }

    const indexPath = path.join(this.databaseDir, 'indexes', `${field}.json`);

    if (!fs.existsSync(indexPath)) {
      throw new Error(`Index not found for field: ${field}`);
    }

    try {
      const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      this.indexCache.set(field, indexData);
      return indexData;
    } catch (error) {
      throw new Error(`Failed to load index for field ${field}: ${error}`);
    }
  }

  private async loadPrimaryIndex(): Promise<any> {
    const indexPath = path.join(this.databaseDir, 'indexes', '_primary.json');

    if (!fs.existsSync(indexPath)) {
      throw new Error('Primary index not found');
    }

    try {
      return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    } catch (error) {
      throw new Error(`Failed to load primary index: ${error}`);
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

    const filePath = path.join(this.databaseDir, 'data', fileInfo.filename);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (this.splitMetadata!.batchSize > 1) {
        // Batch file - find the specific record
        const record = Array.isArray(fileContent)
          ? fileContent.find(r => r[this.splitMetadata!.primaryKeyField] === recordId)
          : null;

        if (record) {
          this.recordCache.set(recordId, record);
        }
        return record || null;
      } else {
        // Individual record file
        if (fileContent[this.splitMetadata!.primaryKeyField] === recordId) {
          this.recordCache.set(recordId, fileContent);
          return fileContent;
        }
      }
    } catch (error) {
      console.error(`Failed to load record ${recordId}:`, error);
    }

    return null;
  }

  private async getAllRecordIds(): Promise<Set<string>> {
    // Use primary key index to get all record IDs efficiently
    const primaryIndex = await this.loadPrimaryIndex();
    const allIds = new Set<string>();

    primaryIndex.entries.forEach((entry: any) => {
      allIds.add(entry.id);
    });

    return allIds;
  }

  // Utility methods
  async count(): Promise<number> {
    return this.metadata?.totalRecords || 0;
  }

  async getFields(): Promise<string[]> {
    return this.metadata?.fields || [];
  }

  async getIndexedFields(): Promise<string[]> {
    return this.metadata?.indexes.map(idx => idx.field) || [];
  }

  async getStats(): Promise<DatabaseMetadata | undefined> {
    return this.metadata;
  }
}
