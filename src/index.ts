// Builder exports
export { AntipatternBuilder } from './builder/index.js';
export type { BuilderOptions, BuildResult } from './builder/index.js';

// Runtime exports
export { AntipatternDB, QueryBuilder } from './runtime/query-client.js';
export type {
  DatabaseRecord,
  DatabaseIndex,
  DatabaseMetadata,
  SplitMetadata,
  QueryFilter,
  QuerySort,
  QueryOptions,
  QueryResult,
} from './runtime/query-client.js';

// Schema generator exports
export { default as JSONToZodGenerator } from './jsontozod.js';

// Type exports
export type * from './types/index.js';
