import { z } from 'zod';

export interface DatabaseRecord {
  [key: string]: any;
}

export interface QueryFilter {
  field: string;
  operator: QueryOperator;
  value: unknown;
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
  total: number;
  hasMore: boolean;
  metadata: {
    took: number;
    query: {
      filters: QueryFilter[];
      options: QueryOptions;
    };
  };
}

export enum QueryOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN = 'less_than',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  IN = 'in',
  NOT_IN = 'not_in',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  REGEX = 'regex',
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists',
}

export interface DatabaseMetadata {
  totalRecords: number;
  totalFields: number;
  buildTimestamp: string;
  indexedFields: string[];
  primaryKeyField: string;
}

interface SplitMetadata {
  totalFiles: number;
  batchSize: number;
  primaryKeyField: string;
  files: Array<{
    filename: string;
    recordIds: string[];
    size: number;
  }>;
}

interface DatabaseIndex {
  [value: string]: string[]; // value -> array of record IDs
}

export class BrowserQueryBuilder<T = DatabaseRecord> {
  private filters: QueryFilter[] = [];
  private options: QueryOptions = {};

  constructor(private client: BrowserAntipatternDB) {}

  where(field: string): BrowserFieldQuery<T> {
    return new BrowserFieldQuery<T>(this, field);
  }

  limit(count: number): this {
    this.options.limit = count;
    return this;
  }

  offset(count: number): this {
    this.options.offset = count;
    return this;
  }

  sort(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    if (!this.options.sort) {
      this.options.sort = [];
    }
    this.options.sort.push({ field, direction });
    return this;
  }

  addFilter(filter: QueryFilter): this {
    this.filters.push(filter);
    return this;
  }

  async exec(): Promise<QueryResult<T>> {
    return this.client.executeQuery<T>(this.filters, this.options);
  }
}

export class BrowserFieldQuery<T = DatabaseRecord> {
  constructor(
    private builder: BrowserQueryBuilder<T>,
    private field: string
  ) {}

  equals(value: unknown): BrowserQueryBuilder<T> {
    return this.builder.addFilter({
      field: this.field,
      operator: QueryOperator.EQUALS,
      value,
    });
  }

  notEquals(value: unknown): BrowserQueryBuilder<T> {
    return this.builder.addFilter({
      field: this.field,
      operator: QueryOperator.NOT_EQUALS,
      value,
    });
  }

  greaterThan(value: unknown): BrowserQueryBuilder<T> {
    return this.builder.addFilter({
      field: this.field,
      operator: QueryOperator.GREATER_THAN,
      value,
    });
  }

  greaterThanOrEqual(value: unknown): BrowserQueryBuilder<T> {
    return this.builder.addFilter({
      field: this.field,
      operator: QueryOperator.GREATER_THAN_OR_EQUAL,
      value,
    });
  }

  lessThan(value: unknown): BrowserQueryBuilder<T> {
    return this.builder.addFilter({
      field: this.field,
      operator: QueryOperator.LESS_THAN,
      value,
    });
  }

  lessThanOrEqual(value: unknown): BrowserQueryBuilder<T> {
    return this.builder.addFilter({
      field: this.field,
      operator: QueryOperator.LESS_THAN_OR_EQUAL,
      value,
    });
  }

  in(values: unknown[]): BrowserQueryBuilder<T> {
    return this.builder.addFilter({
      field: this.field,
      operator: QueryOperator.IN,
      value: values,
    });
  }

  notIn(values: unknown[]): BrowserQueryBuilder<T> {
    return this.builder.addFilter({
      field: this.field,
      operator: QueryOperator.NOT_IN,
      value: values,
    });
  }

  contains(value: string): BrowserQueryBuilder<T> {
    return this.builder.addFilter({
      field: this.field,
      operator: QueryOperator.CONTAINS,
      value,
    });
  }

  notContains(value: string): BrowserQueryBuilder<T> {
    return this.builder.addFilter({
      field: this.field,
      operator: QueryOperator.NOT_CONTAINS,
      value,
    });
  }

  startsWith(value: string): BrowserQueryBuilder<T> {
    return this.builder.addFilter({
      field: this.field,
      operator: QueryOperator.STARTS_WITH,
      value,
    });
  }

  endsWith(value: string): BrowserQueryBuilder<T> {
    return this.builder.addFilter({
      field: this.field,
      operator: QueryOperator.ENDS_WITH,
      value,
    });
  }

  exists(): BrowserQueryBuilder<T> {
    return this.builder.addFilter({
      field: this.field,
      operator: QueryOperator.EXISTS,
      value: true,
    });
  }

  notExists(): BrowserQueryBuilder<T> {
    return this.builder.addFilter({
      field: this.field,
      operator: QueryOperator.NOT_EXISTS,
      value: true,
    });
  }
}

export class BrowserAntipatternDB {
  private baseUrl: string;
  private metadata?: DatabaseMetadata;
  private splitMetadata?: SplitMetadata;
  private indexCache = new Map<string, DatabaseIndex>();
  private recordCache = new Map<string, DatabaseRecord>();
  private schema?: z.ZodSchema;

  constructor(baseUrl: string) {
    // Remove trailing slash for consistency
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async init(): Promise<void> {
    await Promise.all([this.loadMetadata(), this.loadSchema()]);
  }

  private async loadMetadata(): Promise<void> {
    try {
      const [metadataResponse, splitMetadataResponse] = await Promise.all([
        fetch(`${this.baseUrl}/metadata.json`),
        fetch(`${this.baseUrl}/split-metadata.json`),
      ]);

      if (!metadataResponse.ok || !splitMetadataResponse.ok) {
        throw new Error('Database metadata files not found');
      }

      this.metadata = await metadataResponse.json();
      this.splitMetadata = await splitMetadataResponse.json();
    } catch (error) {
      throw new Error(`Failed to load metadata: ${error}`);
    }
  }

  private async loadSchema(): Promise<void> {
    try {
      // Schema loading is optional for browser clients
      // The schema validation will be handled on the generated client side
    } catch (error) {
      // Schema loading is optional
      console.warn('Could not load schema for validation');
    }
  }

  query<T = DatabaseRecord>(): BrowserQueryBuilder<T> {
    return new BrowserQueryBuilder<T>(this);
  }

  async executeQuery<T = DatabaseRecord>(
    filters: QueryFilter[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = performance.now();

    if (!this.metadata || !this.splitMetadata) {
      await this.init();
    }

    let candidateRecordIds: Set<string> | null = null;

    // Try to use indexes for efficient filtering
    for (const filter of filters) {
      let filterRecordIds: Set<string> | null = null;

      const indexData = await this.loadIndex(filter.field);
      if (indexData) {
        const resultIds = new Set<string>();

        if (filter.operator === QueryOperator.EQUALS) {
          // Handle simple key-value lookup for older index format
          const recordIds = indexData[String(filter.value)] || [];
          if (Array.isArray(recordIds)) {
            recordIds.forEach(id => resultIds.add(id));
          }
          filterRecordIds = resultIds;
        } else if ((indexData as any).entries) {
          // Handle all other operators using the entries array
          const entries = (indexData as any).entries;
          for (const entry of entries) {
            let matches = false;

            switch (filter.operator) {
              case QueryOperator.NOT_EQUALS:
                matches = entry.value !== filter.value;
                break;
              case QueryOperator.GREATER_THAN:
                matches =
                  typeof entry.value === 'number' && typeof filter.value === 'number'
                    ? entry.value > filter.value
                    : false;
                break;
              case QueryOperator.GREATER_THAN_OR_EQUAL:
                matches =
                  typeof entry.value === 'number' && typeof filter.value === 'number'
                    ? entry.value >= filter.value
                    : false;
                break;
              case QueryOperator.LESS_THAN:
                matches =
                  typeof entry.value === 'number' && typeof filter.value === 'number'
                    ? entry.value < filter.value
                    : false;
                break;
              case QueryOperator.LESS_THAN_OR_EQUAL:
                matches =
                  typeof entry.value === 'number' && typeof filter.value === 'number'
                    ? entry.value <= filter.value
                    : false;
                break;
              case QueryOperator.IN:
                matches = Array.isArray(filter.value) && filter.value.includes(entry.value);
                break;
              case QueryOperator.NOT_IN:
                matches = Array.isArray(filter.value) && !filter.value.includes(entry.value);
                break;
              case QueryOperator.CONTAINS:
                matches =
                  typeof entry.value === 'string' &&
                  typeof filter.value === 'string' &&
                  entry.value.toLowerCase().includes(filter.value.toLowerCase());
                break;
              case QueryOperator.NOT_CONTAINS:
                matches =
                  typeof entry.value === 'string' &&
                  typeof filter.value === 'string' &&
                  !entry.value.toLowerCase().includes(filter.value.toLowerCase());
                break;
              case QueryOperator.STARTS_WITH:
                matches =
                  typeof entry.value === 'string' &&
                  typeof filter.value === 'string' &&
                  entry.value.toLowerCase().startsWith(filter.value.toLowerCase());
                break;
              case QueryOperator.ENDS_WITH:
                matches =
                  typeof entry.value === 'string' &&
                  typeof filter.value === 'string' &&
                  entry.value.toLowerCase().endsWith(filter.value.toLowerCase());
                break;
              case QueryOperator.REGEX:
                if (typeof entry.value === 'string' && typeof filter.value === 'string') {
                  try {
                    const regex = new RegExp(filter.value, 'i');
                    matches = regex.test(entry.value);
                  } catch {
                    matches = false;
                  }
                }
                break;
              case QueryOperator.EXISTS:
                matches = entry.value !== undefined && entry.value !== null;
                break;
              case QueryOperator.NOT_EXISTS:
                matches = entry.value === undefined || entry.value === null;
                break;
            }

            if (matches) {
              entry.recordIds.forEach((id: string) => resultIds.add(id));
            }
          }
          filterRecordIds = resultIds;
        }
      }

      if (filterRecordIds) {
        if (candidateRecordIds === null) {
          candidateRecordIds = filterRecordIds;
        } else {
          // Intersection with previous results
          candidateRecordIds = new Set(
            [...candidateRecordIds].filter((id: string) => filterRecordIds!.has(id))
          );
        }
      }
    }

    // If no indexes were used, get all record IDs
    if (candidateRecordIds === null) {
      const primaryIndex = await this.loadPrimaryIndex();
      candidateRecordIds = new Set(Object.keys(primaryIndex));
    }

    // Load and filter records
    const records: T[] = [];
    const recordIds = Array.from(candidateRecordIds);

    for (const recordId of recordIds) {
      const record = await this.loadRecord(recordId);
      if (record && this.matchesAllFilters(record, filters)) {
        records.push(record as T);
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

    const endTime = performance.now();

    return {
      records: paginatedRecords,
      total: totalRecords,
      hasMore,
      metadata: {
        took: endTime - startTime,
        query: { filters, options },
      },
    };
  }

  private matchesAllFilters(record: DatabaseRecord, filters: QueryFilter[]): boolean {
    if (!filters.length) return true;
    return filters.every(filter => this.matchesFilter(record, filter));
  }

  private matchesFilter(record: DatabaseRecord, filter: QueryFilter): boolean {
    const value = this.getNestedValue(record, filter.field);

    switch (filter.operator) {
      case QueryOperator.EQUALS:
        return value === filter.value;
      case QueryOperator.NOT_EQUALS:
        return value !== filter.value;
      case QueryOperator.GREATER_THAN:
        return (
          typeof value === 'number' && typeof filter.value === 'number' && value > filter.value
        );
      case QueryOperator.GREATER_THAN_OR_EQUAL:
        return (
          typeof value === 'number' && typeof filter.value === 'number' && value >= filter.value
        );
      case QueryOperator.LESS_THAN:
        return (
          typeof value === 'number' && typeof filter.value === 'number' && value < filter.value
        );
      case QueryOperator.LESS_THAN_OR_EQUAL:
        return (
          typeof value === 'number' && typeof filter.value === 'number' && value <= filter.value
        );
      case QueryOperator.IN:
        return Array.isArray(filter.value) && filter.value.includes(value);
      case QueryOperator.NOT_IN:
        return Array.isArray(filter.value) && !filter.value.includes(value);
      case QueryOperator.CONTAINS:
        return (
          typeof value === 'string' &&
          typeof filter.value === 'string' &&
          value.toLowerCase().includes(filter.value.toLowerCase())
        );
      case QueryOperator.NOT_CONTAINS:
        return (
          typeof value === 'string' &&
          typeof filter.value === 'string' &&
          !value.toLowerCase().includes(filter.value.toLowerCase())
        );
      case QueryOperator.STARTS_WITH:
        return (
          typeof value === 'string' &&
          typeof filter.value === 'string' &&
          value.toLowerCase().startsWith(filter.value.toLowerCase())
        );
      case QueryOperator.ENDS_WITH:
        return (
          typeof value === 'string' &&
          typeof filter.value === 'string' &&
          value.toLowerCase().endsWith(filter.value.toLowerCase())
        );
      case QueryOperator.REGEX:
        if (typeof value !== 'string' || typeof filter.value !== 'string') return false;
        try {
          const regex = new RegExp(filter.value, 'i');
          return regex.test(value);
        } catch {
          return false;
        }
      case QueryOperator.EXISTS:
        return value !== undefined && value !== null;
      case QueryOperator.NOT_EXISTS:
        return value === undefined || value === null;
      default:
        return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  }

  private applySorting<T>(records: T[], sortOptions: QuerySort[]): void {
    records.sort((a, b) => {
      for (const sort of sortOptions) {
        const aValue = this.getNestedValue(a, sort.field);
        const bValue = this.getNestedValue(b, sort.field);

        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        else if (aValue > bValue) comparison = 1;

        if (comparison !== 0) {
          return sort.direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  private async loadIndex(field: string): Promise<DatabaseIndex | null> {
    if (this.indexCache.has(field)) {
      return this.indexCache.get(field)!;
    }

    try {
      const response = await fetch(`${this.baseUrl}/indexes/${field}.json`);
      if (!response.ok) {
        return null;
      }

      const indexData = await response.json();
      this.indexCache.set(field, indexData);
      return indexData;
    } catch (error) {
      console.warn(`Failed to load index for field ${field}:`, error);
      return null;
    }
  }

  private async loadPrimaryIndex(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/indexes/_primary.json`);
      if (!response.ok) {
        throw new Error('Primary index not found');
      }

      return await response.json();
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

    try {
      const response = await fetch(`${this.baseUrl}/data/${fileInfo.filename}`);
      if (!response.ok) {
        return null;
      }

      const fileContent = await response.json();

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

  async getMetadata(): Promise<DatabaseMetadata | undefined> {
    if (!this.metadata) {
      await this.loadMetadata();
    }
    return this.metadata;
  }

  async getRecord<T = DatabaseRecord>(id: string): Promise<T | null> {
    return (await this.loadRecord(id)) as T | null;
  }

  async getAllRecords<T = DatabaseRecord>(limit?: number): Promise<T[]> {
    const result = await this.executeQuery<T>([], { limit });
    return result.records;
  }
}
