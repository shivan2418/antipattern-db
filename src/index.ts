// Main exports for the antipattern-db library

// Builder functionality
export { AntipatternBuilder } from './builder/index.js';
export type { BuilderOptions, BuildResult } from './builder/index.js';

// Schema generation
export { default as JSONToZodGenerator } from './jsontozod.js';

// Runtime query functionality
export { AntipatternDB, QueryBuilder, QueryOperator } from './runtime/query-client.js';
export { TypedDatabaseClient } from './runtime/typed-client.js';
export { TypeSafeQueryBuilder, FieldPaths } from './runtime/typed-query-builder.js';

// Browser-compatible runtime
export {
  BrowserAntipatternDB,
  BrowserQueryBuilder,
  BrowserFieldQuery,
  QueryOperator as BrowserQueryOperator,
} from './runtime/browser-client.js';
export {
  BrowserTypedDatabaseClient,
  createBrowserTypedClient,
} from './runtime/browser-typed-client.js';
export type {
  QueryResult,
  QueryFilter,
  QuerySort,
  QueryOptions,
  DatabaseRecord,
} from './runtime/query-client.js';

// Core types
export type {
  DatabaseIndex,
  DatabaseMetadata,
  BuilderConfig,
  BuilderResult,
  CLIOptions,
} from './types/index.js';
