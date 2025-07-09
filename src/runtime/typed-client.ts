import { AntipatternDB, QueryBuilder } from './query-client.js';
import { TypeSafeQueryBuilder } from './typed-query-builder.js';
import { z } from 'zod';

/**
 * Type-safe database client that wraps AntipatternDB with specific record types
 */
export class TypedDatabaseClient<
  TRecord extends Record<string, unknown>,
  TSchema extends z.ZodSchema = z.ZodSchema,
> {
  private client: AntipatternDB;
  private schema?: TSchema;
  private initialized = false;

  constructor(databasePath: string, schema?: TSchema) {
    this.client = new AntipatternDB(databasePath);
    this.schema = schema;
  }

  /**
   * Initialize the database connection
   */
  async init(): Promise<void> {
    if (!this.initialized) {
      await this.client.init();
      this.initialized = true;
    }
  }

  /**
   * Ensure the database is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call init() first.');
    }
  }

  /**
   * Create a type-safe query that constrains field names to valid record keys
   */
  query(): TypeSafeQueryBuilder<TRecord> {
    this.ensureInitialized();
    // Create a type-safe query builder that uses the client's executeQuery method
    return new TypeSafeQueryBuilder<TRecord>((filters, options) => 
      this.client._executeQuery<TRecord>(filters, options)
    );
  }

  /**
   * Create a legacy query builder for backward compatibility
   * @deprecated Use query() for type safety
   */
  queryLegacy(): QueryBuilder<TRecord> {
    this.ensureInitialized();
    return this.client.query<TRecord>();
  }

  /**
   * Get a single record by ID with type safety
   */
  async get(id: string): Promise<TRecord | null> {
    this.ensureInitialized();
    return this.client.get<TRecord>(id);
  }

  /**
   * Count total records
   */
  async count(): Promise<number> {
    this.ensureInitialized();
    return this.client.count();
  }

  /**
   * Get all available fields
   */
  async getFields(): Promise<string[]> {
    this.ensureInitialized();
    return this.client.getFields();
  }

  /**
   * Get indexed fields
   */
  async getIndexedFields(): Promise<string[]> {
    this.ensureInitialized();
    return this.client.getIndexedFields();
  }

  /**
   * Validate a record against the schema (if provided)
   */
  validate(record: unknown): TRecord {
    if (!this.schema) {
      throw new Error('No schema provided for validation');
    }
    return this.schema.parse(record) as TRecord;
  }

  /**
   * Safely validate a record with error handling
   */
  safeValidate(
    record: unknown
  ): { success: true; data: TRecord } | { success: false; error: z.ZodError } {
    if (!this.schema) {
      return {
        success: false,
        error: new z.ZodError([
          { code: 'custom', message: 'No schema provided for validation', path: [] },
        ]),
      };
    }

    const result = this.schema.safeParse(record);
    if (result.success) {
      return { success: true, data: result.data as TRecord };
    } else {
      return { success: false, error: result.error };
    }
  }

  /**
   * Get the underlying client for advanced usage
   */
  getClient(): AntipatternDB {
    return this.client;
  }
}

/**
 * Factory function to create a typed client with specific types
 */
export function createTypedClient<
  TRecord extends Record<string, unknown>,
  TSchema extends z.ZodSchema = z.ZodSchema,
>(databasePath: string, schema?: TSchema): TypedDatabaseClient<TRecord, TSchema> {
  return new TypedDatabaseClient<TRecord, TSchema>(databasePath, schema);
}
