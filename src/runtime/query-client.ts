import {
  QueryEngine,
  QueryOperator,
  type QueryFilter,
  type QuerySort,
  type QueryOptions,
  type QueryResult,
} from './core/query-engine.js';
import type { DatabaseRecord, DatabaseMetadata } from './core/data-loader.js';
import { NodeDataLoader } from './adapters/node-data-loader.js';

// Re-export types from core
export { QueryOperator };
export type { QueryFilter, QuerySort, QueryOptions, QueryResult };
export type { DatabaseRecord, DatabaseMetadata };

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
  private engine: QueryEngine;

  constructor(databaseDir: string) {
    const dataLoader = new NodeDataLoader(databaseDir);
    this.engine = new QueryEngine(dataLoader);
  }

  async init(): Promise<void> {
    await this.engine.init();
  }

  query<T = DatabaseRecord>(): QueryBuilder<T> {
    return new QueryBuilder<T>(this);
  }

  async get<T = DatabaseRecord>(id: string): Promise<T | null> {
    return this.engine.getRecord<T>(id);
  }

  async _executeQuery<T = DatabaseRecord>(
    filters: QueryFilter[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    return this.engine.executeQuery<T>(filters, options);
  }

  // Utility methods
  async count(): Promise<number> {
    return this.engine.count();
  }

  async getFields(): Promise<string[]> {
    return this.engine.getFields();
  }

  async getIndexedFields(): Promise<string[]> {
    return this.engine.getIndexedFields();
  }

  async getStats(): Promise<DatabaseMetadata | undefined> {
    return this.engine.getStats();
  }
}
