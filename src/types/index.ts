import { z } from 'zod';

// Core database types
export interface DatabaseRecord {
  id: string;
  [key: string]: any;
}

export interface DatabaseIndex {
  [fieldValue: string]: string[]; // field value -> array of record IDs
}

export interface DatabaseMetadata {
  recordCount: number;
  fields: string[];
  indexedFields: string[];
  schema: Record<string, any>;
  created: string;
  version: string;
}

// Builder types
export interface BuilderConfig {
  outputDir: string;
  indexFields?: string[];
  compression?: boolean;
  chunkSize?: number;
  generateSchema?: boolean;
}

export interface BuilderResult {
  recordCount: number;
  filesGenerated: number;
  indexesCreated: string[];
  outputDir: string;
  schema?: z.ZodSchema;
}

// Runtime types
export interface QueryFilter {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'contains';
  value: any;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

export interface QueryResult<T = DatabaseRecord> {
  records: T[];
  totalCount: number;
  hasMore: boolean;
}

// Query builder types
export interface QueryBuilder<T = DatabaseRecord> {
  where(field: string, operator: QueryFilter['operator'], value: any): QueryBuilder<T>;
  where(field: string, value: any): QueryBuilder<T>;
  sort(field: string, direction?: 'asc' | 'desc'): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  offset(count: number): QueryBuilder<T>;
  exec(): Promise<QueryResult<T>>;
}

// CLI types
export interface CLIOptions {
  input: string;
  output: string;
  indexFields?: string[];
  compression?: boolean;
  verbose?: boolean;
}
