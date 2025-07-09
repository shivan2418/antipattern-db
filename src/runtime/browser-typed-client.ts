import { BrowserAntipatternDB, QueryResult, QueryFilter, QueryOptions } from './browser-client.js';
import { TypeSafeQueryBuilder } from './typed-query-builder.js';
import { z } from 'zod';

/**
 * Browser-compatible type-safe database client that wraps BrowserAntipatternDB with specific record types
 */
export class BrowserTypedDatabaseClient<
  TRecord extends Record<string, unknown>,
  TSchema extends z.ZodSchema = z.ZodSchema,
> {
  private client: BrowserAntipatternDB;
  private schema?: TSchema;
  private initialized = false;

  constructor(baseUrl: string, schema?: TSchema) {
    this.client = new BrowserAntipatternDB(baseUrl);
    this.schema = schema;
  }

  /**
   * Initialize the database client
   * This is automatically called on first query, but can be called manually for error handling
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await this.client.init();
    this.initialized = true;
  }

  /**
   * Create a type-safe query builder
   * Database auto-initializes on first use
   */
  query(): TypeSafeQueryBuilder<TRecord> {
    // Create a bound executeQuery function for the TypeSafeQueryBuilder
    const executeQuery = async (
      filters: QueryFilter[],
      options?: QueryOptions
    ): Promise<QueryResult<TRecord>> => {
      if (!this.initialized) {
        await this.init();
      }
      return this.client.executeQuery<TRecord>(filters, options);
    };
    return new TypeSafeQueryBuilder<TRecord>(executeQuery as any);
  }

  /**
   * Get a record by its primary key
   */
  async getRecord(id: string): Promise<TRecord | null> {
    if (!this.initialized) {
      await this.init();
    }
    return this.client.getRecord<TRecord>(id);
  }

  /**
   * Get all records (with optional limit)
   */
  async getAllRecords(limit?: number): Promise<TRecord[]> {
    if (!this.initialized) {
      await this.init();
    }
    return this.client.getAllRecords<TRecord>(limit);
  }

  /**
   * Get database metadata
   */
  async getMetadata() {
    if (!this.initialized) {
      await this.init();
    }
    return this.client.getMetadata();
  }

  /**
   * Validate a record against the schema (if provided)
   */
  validateRecord(record: unknown): TRecord {
    if (this.schema) {
      return this.schema.parse(record) as TRecord;
    }
    return record as TRecord;
  }

  /**
   * Get the underlying browser client (for advanced usage)
   */
  getClient(): BrowserAntipatternDB {
    return this.client;
  }
}

/**
 * Factory function to create a browser-compatible typed client with specific types
 */
export function createBrowserTypedClient<
  TRecord extends Record<string, unknown>,
  TSchema extends z.ZodSchema = z.ZodSchema,
>(baseUrl: string, schema?: TSchema): BrowserTypedDatabaseClient<TRecord, TSchema> {
  return new BrowserTypedDatabaseClient<TRecord, TSchema>(baseUrl, schema);
}
