// Browser-compatible exports for antipattern-db
// Use this import when targeting browser environments

export {
  BrowserAntipatternDB,
  BrowserQueryBuilder,
  BrowserFieldQuery,
  QueryOperator,
  type DatabaseRecord,
  type QueryFilter,
  type QuerySort,
  type QueryOptions,
  type QueryResult,
  type DatabaseMetadata,
} from './runtime/browser-client.js';

export {
  BrowserTypedDatabaseClient,
  createBrowserTypedClient,
} from './runtime/browser-typed-client.js';

export { TypeSafeQueryBuilder, type FieldPaths } from './runtime/typed-query-builder.js';

// Re-export schema generation (works in both environments)
export { default as JSONToZodGenerator } from './jsontozod.js';

// Re-export types
export type { DatabaseIndex, BuilderConfig, BuilderResult, CLIOptions } from './types/index.js';
