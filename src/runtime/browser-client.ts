import {
  QueryEngine,
  type QueryFilter as CoreQueryFilter,
  type QueryOptions as CoreQueryOptions,
} from './core/query-engine.js';
import { BrowserDataLoader } from './adapters/browser-data-loader.js';
import { DatabaseRecord, DatabaseMetadata } from './core/data-loader.js';

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

// Browser-style enum values (lowercase with underscores)
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

// Re-export from core
export type { DatabaseRecord, DatabaseMetadata };

// Mapping between browser and core query operators
const OPERATOR_MAPPING: Record<QueryOperator, string> = {
  [QueryOperator.EQUALS]: 'EQUALS',
  [QueryOperator.NOT_EQUALS]: 'NOT_EQUALS',
  [QueryOperator.GREATER_THAN]: 'GREATER_THAN',
  [QueryOperator.GREATER_THAN_OR_EQUAL]: 'GREATER_THAN_OR_EQUAL',
  [QueryOperator.LESS_THAN]: 'LESS_THAN',
  [QueryOperator.LESS_THAN_OR_EQUAL]: 'LESS_THAN_OR_EQUAL',
  [QueryOperator.IN]: 'IN',
  [QueryOperator.NOT_IN]: 'IN', // Map to IN for now, handle negation in core
  [QueryOperator.CONTAINS]: 'CONTAINS',
  [QueryOperator.NOT_CONTAINS]: 'CONTAINS', // Map to CONTAINS, handle negation in core
  [QueryOperator.STARTS_WITH]: 'STARTS_WITH',
  [QueryOperator.ENDS_WITH]: 'ENDS_WITH',
  [QueryOperator.REGEX]: 'CONTAINS', // Fallback to CONTAINS for regex
  [QueryOperator.EXISTS]: 'EQUALS', // Special handling needed
  [QueryOperator.NOT_EXISTS]: 'EQUALS', // Special handling needed
};

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
      value: undefined,
    });
  }

  notExists(): BrowserQueryBuilder<T> {
    return this.builder.addFilter({
      field: this.field,
      operator: QueryOperator.NOT_EXISTS,
      value: undefined,
    });
  }
}

export class BrowserAntipatternDB {
  private engine: QueryEngine;

  constructor(baseUrl: string) {
    const dataLoader = new BrowserDataLoader(baseUrl);
    this.engine = new QueryEngine(dataLoader);
  }

  async init(): Promise<void> {
    await this.engine.init();
  }

  query<T = DatabaseRecord>(): BrowserQueryBuilder<T> {
    return new BrowserQueryBuilder<T>(this);
  }

  async executeQuery<T = DatabaseRecord>(
    filters: QueryFilter[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = performance.now();

    // Convert browser filters to core filters
    const coreFilters: CoreQueryFilter[] = filters.map(filter => ({
      field: filter.field,
      operator: OPERATOR_MAPPING[filter.operator] as any, // Type assertion needed for enum conversion
      value: filter.value,
    }));

    // Convert browser options to core options
    const coreOptions: CoreQueryOptions = {
      limit: options.limit,
      offset: options.offset,
      sort: options.sort,
    };

    const result = await this.engine.executeQuery<T>(coreFilters, coreOptions);

    const endTime = performance.now();

    // Convert core result to browser result format
    return {
      records: result.records,
      total: result.totalCount,
      hasMore: result.hasMore,
      metadata: {
        took: endTime - startTime,
        query: { filters, options },
      },
    };
  }

  async getMetadata(): Promise<DatabaseMetadata | undefined> {
    return this.engine.getMetadata();
  }

  async getRecord<T = DatabaseRecord>(id: string): Promise<T | null> {
    return this.engine.getRecord<T>(id);
  }

  async getAllRecords<T = DatabaseRecord>(limit?: number): Promise<T[]> {
    return this.engine.getAllRecords<T>(limit);
  }
}
