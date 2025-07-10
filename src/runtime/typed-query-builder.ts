import {
  QueryOperator,
  QueryResult,
  QueryFilter,
  QuerySort,
  QueryOptions,
} from './query-client.js';

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
    }[keyof T]
  | {
      [K in keyof T]: T[K] extends unknown[]
        ? K extends string
          ? T[K] extends (infer U)[]
            ? U extends Record<string, unknown>
              ? `${K}.${Extract<keyof U, string>}`
              : never
            : never
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
        : T[K] extends unknown[]
          ? T[K] extends (infer U)[]
            ? U extends Record<string, unknown>
              ? Rest extends keyof U
                ? U[Rest]
                : unknown
              : unknown
            : unknown
          : unknown
      : unknown
    : unknown;

// Type to extract array element types
export type ArrayElementType<T> = T extends (infer U)[] ? U : never;

// Type to get array fields from a record
export type ArrayFields<T> = {
  [K in keyof T]: T[K] extends unknown[] ? K : never;
}[keyof T];

// Array field filter configuration
export interface ArrayFieldFilter<T, K extends ArrayFields<T> & string> {
  field: K;
  predicate: (item: ArrayElementType<T[K]>) => boolean;
}

// Enhanced query result that includes array filtering metadata
export interface EnhancedQueryResult<T> extends QueryResult<T> {
  arrayFiltersApplied?: boolean;
  originalCounts?: Record<string, number>;
}

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
 * Array field query builder for filtering nested arrays
 */
export class ArrayFieldQueryBuilder<T, K extends ArrayFields<T> & string> {
  constructor(
    private field: K,
    private parentBuilder: TypeSafeQueryBuilder<T>
  ) {}

  /**
   * Filter array elements using a custom predicate function
   */
  where(predicate: (item: ArrayElementType<T[K]>) => boolean): TypeSafeQueryBuilder<T> {
    return this.parentBuilder.addArrayFilter(this.field, predicate);
  }

  /**
   * Filter array elements by a specific field value
   */
  whereField<F extends keyof ArrayElementType<T[K]>>(
    field: F,
    value: ArrayElementType<T[K]>[F]
  ): TypeSafeQueryBuilder<T> {
    return this.where(item => item[field] === value);
  }

  /**
   * Filter array elements where a field contains a value
   */
  whereFieldContains<F extends keyof ArrayElementType<T[K]>>(
    field: F,
    value: string
  ): TypeSafeQueryBuilder<T> {
    return this.where(item => {
      const fieldValue = item[field];
      return (
        typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(value.toLowerCase())
      );
    });
  }

  /**
   * Filter array elements where a field is in a list of values
   */
  whereFieldIn<F extends keyof ArrayElementType<T[K]>>(
    field: F,
    values: ArrayElementType<T[K]>[F][]
  ): TypeSafeQueryBuilder<T> {
    return this.where(item => values.includes(item[field]));
  }

  /**
   * Filter array elements where a field is greater than a value
   */
  whereFieldGreaterThan<F extends keyof ArrayElementType<T[K]>>(
    field: F,
    value: ArrayElementType<T[K]>[F]
  ): TypeSafeQueryBuilder<T> {
    return this.where(item => item[field] > value);
  }

  /**
   * Filter array elements where a field is less than a value
   */
  whereFieldLessThan<F extends keyof ArrayElementType<T[K]>>(
    field: F,
    value: ArrayElementType<T[K]>[F]
  ): TypeSafeQueryBuilder<T> {
    return this.where(item => item[field] < value);
  }
}

/**
 * Type-safe query builder that constrains field names to valid record keys
 */
export class TypeSafeQueryBuilder<T> {
  private filters: QueryFilter[] = [];
  private sortOptions: QuerySort[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private arrayFilters: ArrayFieldFilter<T, any>[] = [];

  constructor(
    private executeQuery: (
      filters: QueryFilter[],
      options?: QueryOptions
    ) => Promise<QueryResult<T>>
  ) {}

  /**
   * Type-safe where method that automatically detects array field filtering
   *
   * @example
   * ```typescript
   * // Record-level filtering (existing behavior)
   * db.query().where('name').equals('John Avon')
   *
   * // Array element filtering (new behavior)
   * db.query().where('cards.set').equals('BRO')  // Filters cards array
   *
   * // You can chain both types
   * db.query()
   *   .where('name').equals('John Avon')    // Find the artist
   *   .where('cards.set').equals('BRO')     // Filter their cards
   *   .where('cards.cost').greaterThan(3)   // Further filter cards
   * ```
   */
  where<F extends FieldPaths<T> & string>(field: F): TypeSafeFieldQueryBuilder<T, F> {
    return new TypeSafeFieldQueryBuilder<T, F>(field, this);
  }

  // Legacy method for backward compatibility (with enum)
  whereRaw(field: string, operator: QueryOperator, value: unknown): TypeSafeQueryBuilder<T> {
    return this.addFilter(field, operator, value);
  }

  // Simple equality method for convenience
  whereEquals<F extends FieldPaths<T> & string>(
    field: F,
    value: PathValue<T, F>
  ): TypeSafeQueryBuilder<T> {
    return this.addFilter(field, QueryOperator.EQUALS, value);
  }

  /**
   * Filter array fields within the query results
   * This allows you to first find records, then filter their nested arrays
   *
   * @example
   * ```typescript
   * // Find artist "John Avon" and only show their cards from the "BRO" set
   * const result = await db.query()
   *   .where('name').equals('John Avon')
   *   .filterArrayField('cards')
   *   .whereField('set', 'BRO')
   *   .exec();
   * ```
   */
  filterArrayField<K extends ArrayFields<T> & string>(field: K): ArrayFieldQueryBuilder<T, K> {
    return new ArrayFieldQueryBuilder<T, K>(field, this);
  }

  /**
   * Filter array field with a custom predicate function
   *
   * @example
   * ```typescript
   * // Find artists and show only their cards from recent sets
   * const result = await db.query()
   *   .where('name').contains('John')
   *   .filterArray('cards', card => new Date(card.releasedAt).getFullYear() >= 2023)
   *   .exec();
   * ```
   */
  filterArray<K extends ArrayFields<T> & string>(
    field: K,
    predicate: (item: ArrayElementType<T[K]>) => boolean
  ): TypeSafeQueryBuilder<T> {
    return this.addArrayFilter(field, predicate);
  }

  // Internal method to add filters
  addFilter(field: string, operator: QueryOperator, value: unknown): TypeSafeQueryBuilder<T> {
    // Detect if this is an array field filter (e.g., "cards.set" vs "cards[].set")
    if (this.isArrayFieldFilter(field)) {
      return this.addArrayFieldFilter(field, operator, value);
    }

    // Regular record-level filter
    this.filters.push({ field, operator, value });
    return this;
  }

  // Internal method to add array filters
  addArrayFilter<K extends ArrayFields<T> & string>(
    field: K,
    predicate: (item: ArrayElementType<T[K]>) => boolean
  ): TypeSafeQueryBuilder<T> {
    this.arrayFilters.push({ field, predicate });
    return this;
  }

  /**
   * Check if a field path refers to an array element (e.g., "cards.set")
   * vs array matching (e.g., "cards[].set")
   */
  private isArrayFieldFilter(field: string): boolean {
    // Look for pattern like "arrayField.subField" but not "arrayField[].subField"
    const parts = field.split('.');
    if (parts.length < 2) return false;

    // Don't treat cards[].set as array filtering (that's for finding records)
    if (field.includes('[]')) return false;

    // This is a heuristic - we assume if it's a two-part path like "cards.set"
    // it's likely an array field filter. In a real implementation, we'd use
    // type information to be more precise.
    return true;
  }

  /**
   * Convert an array field filter to a predicate-based array filter
   */
  private addArrayFieldFilter(
    field: string,
    operator: QueryOperator,
    value: unknown
  ): TypeSafeQueryBuilder<T> {
    const parts = field.split('.');
    const arrayFieldName = parts[0] as ArrayFields<T> & string;
    const subFieldName = parts[1];

    // Create a predicate based on the operator and value
    const predicate = (item: any) => {
      const itemValue = item[subFieldName];

      switch (operator) {
        case QueryOperator.EQUALS:
          return itemValue === value;
        case QueryOperator.NOT_EQUALS:
          return itemValue !== value;
        case QueryOperator.GREATER_THAN:
          return typeof itemValue === 'number' && typeof value === 'number' && itemValue > value;
        case QueryOperator.GREATER_THAN_OR_EQUAL:
          return typeof itemValue === 'number' && typeof value === 'number' && itemValue >= value;
        case QueryOperator.LESS_THAN:
          return typeof itemValue === 'number' && typeof value === 'number' && itemValue < value;
        case QueryOperator.LESS_THAN_OR_EQUAL:
          return typeof itemValue === 'number' && typeof value === 'number' && itemValue <= value;
        case QueryOperator.IN:
          return Array.isArray(value) && value.includes(itemValue);
        case QueryOperator.CONTAINS:
          if (Array.isArray(itemValue)) {
            return itemValue.includes(value);
          }
          return (
            typeof itemValue === 'string' &&
            typeof value === 'string' &&
            itemValue.toLowerCase().includes(value.toLowerCase())
          );
        case QueryOperator.STARTS_WITH:
          return (
            typeof itemValue === 'string' &&
            typeof value === 'string' &&
            itemValue.toLowerCase().startsWith(value.toLowerCase())
          );
        case QueryOperator.ENDS_WITH:
          return (
            typeof itemValue === 'string' &&
            typeof value === 'string' &&
            itemValue.toLowerCase().endsWith(value.toLowerCase())
          );
        default:
          return false;
      }
    };

    return this.addArrayFilter(arrayFieldName, predicate);
  }

  sort<F extends FieldPaths<T> & string>(
    field: F,
    direction: 'asc' | 'desc' = 'asc'
  ): TypeSafeQueryBuilder<T> {
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

  async exec(): Promise<EnhancedQueryResult<T>> {
    // Execute the base query
    const baseResult = await this.executeQuery(this.filters, {
      limit: this.limitValue,
      offset: this.offsetValue,
      sort: this.sortOptions,
    });

    // If no array filters, return the base result
    if (this.arrayFilters.length === 0) {
      return baseResult as EnhancedQueryResult<T>;
    }

    // Apply array filters to each record
    const originalCounts: Record<string, number> = {};
    const filteredRecords = baseResult.records.map(record => {
      // Use JSON clone to avoid type issues
      const filteredRecord = JSON.parse(JSON.stringify(record)) as Record<string, any>;

      for (const arrayFilter of this.arrayFilters) {
        const { field, predicate } = arrayFilter;
        const arrayValue = (record as Record<string, any>)[field as string];

        if (Array.isArray(arrayValue)) {
          // Store original count for metadata
          if (!originalCounts[field as string]) {
            originalCounts[field as string] = arrayValue.length;
          }

          // Apply the filter
          const filteredArray = arrayValue.filter(predicate);
          filteredRecord[field as string] = filteredArray;

          // If there's a corresponding count field, update it
          const countField = `${field as string}Count`;
          if (
            countField in record &&
            typeof (record as Record<string, any>)[countField] === 'number'
          ) {
            filteredRecord[countField] = filteredArray.length;
          }
        }
      }

      return filteredRecord;
    });

    return {
      ...baseResult,
      records: filteredRecords,
      arrayFiltersApplied: true,
      originalCounts,
    } as EnhancedQueryResult<T>;
  }
}
