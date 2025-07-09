import { QueryOperator, QueryResult, QueryFilter, QuerySort, QueryOptions } from './query-client.js';

// Simpler approach to nested field paths to avoid excessive stack depth
// We'll support up to 3 levels of nesting which covers most common use cases
export type FieldPaths<T> = 
  | keyof T
  | {
      [K in keyof T]: T[K] extends Record<string, unknown>
        ? K extends string
          ? `${K}.${Extract<keyof T[K], string>}`
          : never
        : never;
    }[keyof T]
  | {
      [K in keyof T]: T[K] extends Record<string, unknown>
        ? K extends string
          ? {
              [K2 in keyof T[K]]: T[K][K2] extends Record<string, unknown>
                ? K2 extends string
                  ? `${K}.${K2}.${Extract<keyof T[K][K2], string>}`
                  : never
                : never;
            }[keyof T[K]]
          : never
        : never;
    }[keyof T];

// Get the type of a value at a given path (simplified version)
export type PathValue<T, P extends string> = P extends keyof T
  ? T[P]
  : P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? T[K] extends Record<string, unknown>
      ? Rest extends keyof T[K]
        ? T[K][Rest]
        : Rest extends `${infer K2}.${infer Rest2}`
        ? K2 extends keyof T[K]
          ? T[K][K2] extends Record<string, unknown>
            ? Rest2 extends keyof T[K][K2]
              ? T[K][K2][Rest2]
              : unknown
            : unknown
          : unknown
        : unknown
      : unknown
    : unknown
  : unknown;

/**
 * Type-safe field query builder that constrains field names to valid paths
 */
export class TypeSafeFieldQueryBuilder<T, F extends string> {
  constructor(
    private field: F,
    private parentBuilder: TypeSafeQueryBuilder<T>
  ) {}

  equals(value: PathValue<T, F>): TypeSafeQueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.EQUALS, value);
  }

  notEquals(value: PathValue<T, F>): TypeSafeQueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.NOT_EQUALS, value);
  }

  greaterThan(value: PathValue<T, F>): TypeSafeQueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.GREATER_THAN, value);
  }

  lessThan(value: PathValue<T, F>): TypeSafeQueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.LESS_THAN, value);
  }

  greaterThanOrEqual(value: PathValue<T, F>): TypeSafeQueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.GREATER_THAN_OR_EQUAL, value);
  }

  lessThanOrEqual(value: PathValue<T, F>): TypeSafeQueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.LESS_THAN_OR_EQUAL, value);
  }

  in(values: PathValue<T, F>[]): TypeSafeQueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.IN, values);
  }

  contains(value: unknown): TypeSafeQueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.CONTAINS, value);
  }

  startsWith(value: string): TypeSafeQueryBuilder<T> {
    return this.parentBuilder.addFilter(this.field, QueryOperator.STARTS_WITH, value);
  }

  endsWith(value: string): TypeSafeQueryBuilder<T> {
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

/**
 * Type-safe query builder that constrains field names to valid record keys
 */
export class TypeSafeQueryBuilder<T> {
  private filters: QueryFilter[] = [];
  private sortOptions: QuerySort[] = [];
  private limitValue?: number;
  private offsetValue?: number;

  constructor(private executeQuery: (filters: QueryFilter[], options?: QueryOptions) => Promise<QueryResult<T>>) {}

  // Type-safe where method that only allows valid field paths
  where<F extends FieldPaths<T> & string>(field: F): TypeSafeFieldQueryBuilder<T, F> {
    return new TypeSafeFieldQueryBuilder<T, F>(field, this);
  }

  // Legacy method for backward compatibility (with enum)
  whereRaw(field: string, operator: QueryOperator, value: unknown): TypeSafeQueryBuilder<T> {
    return this.addFilter(field, operator, value);
  }

  // Simple equality method for convenience
  whereEquals<F extends FieldPaths<T> & string>(field: F, value: PathValue<T, F>): TypeSafeQueryBuilder<T> {
    return this.addFilter(field, QueryOperator.EQUALS, value);
  }

  // Internal method to add filters
  addFilter(field: string, operator: QueryOperator, value: unknown): TypeSafeQueryBuilder<T> {
    this.filters.push({ field, operator, value });
    return this;
  }

  sort<F extends FieldPaths<T> & string>(field: F, direction: 'asc' | 'desc' = 'asc'): TypeSafeQueryBuilder<T> {
    this.sortOptions.push({ field, direction });
    return this;
  }

  limit(count: number): TypeSafeQueryBuilder<T> {
    this.limitValue = count;
    return this;
  }

  offset(count: number): TypeSafeQueryBuilder<T> {
    this.offsetValue = count;
    return this;
  }

  async exec(): Promise<QueryResult<T>> {
    return this.executeQuery(this.filters, {
      limit: this.limitValue,
      offset: this.offsetValue,
      sort: this.sortOptions,
    });
  }
} 