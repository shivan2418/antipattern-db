import * as fs from 'fs';
import * as path from 'path';

export interface ClientGeneratorOptions {
  outputDir: string;
  primaryKeyField?: string;
}

export class ClientGenerator {
  private options: ClientGeneratorOptions;

  constructor(options: ClientGeneratorOptions) {
    this.options = {
      primaryKeyField: 'id',
      ...options,
    };
  }

  /**
   * Generate a type-safe database client pre-configured with the generated types
   */
  async generateClient(): Promise<void> {
    console.log('🎯 Generating type-safe database client...');

    const clientContent = this.generateClientCode();
    const clientPath = path.join(this.options.outputDir, 'client.ts');

    fs.writeFileSync(clientPath, clientContent);

    console.log('  ✅ Generated type-safe database client');
  }

  private generateClientCode(): string {
    return `// Auto-generated database client
// This file provides a pre-configured, type-safe database client

import { TypedDatabaseClient } from '../src/runtime/typed-client.js';
import { FieldPaths } from '../src/runtime/typed-query-builder.js';
import { RecordSchema } from './schema.js';
import type { GeneratedRecord } from './types.js';

/**
 * Pre-configured, type-safe database client with field name constraints
 * 
 * Features:
 * - Field names are constrained to actual record properties
 * - Nested field access (e.g., 'profile.age') is supported up to 3 levels
 * - Compile-time error if you try to query non-existent fields
 * 
 * Usage:
 *   import { db } from './database';
 *
 *   // ✅ Type-safe - only allows valid field names
 *   // Database auto-initializes on first use
 *   const results = await db.query()
 *     .where('status').equals('active')  // 'status' must exist in GeneratedRecord
 *     .where('profile.age').greaterThan(25)  // nested fields supported
 *     .exec();
 *
 *   // ❌ Compile error - field doesn't exist
 *   // const results = await db.query().where('nonExistentField').equals('value');
 *
 *   // Optional: Manual initialization (for error handling)
 *   // await db.init();
 */
export const db = new TypedDatabaseClient<GeneratedRecord, typeof RecordSchema>(
  import.meta.dirname || '.',
  RecordSchema
);

// Re-export types for convenience
export type { GeneratedRecord } from './types.js';
export { RecordSchema } from './schema.js';
export { TypedDatabaseClient } from '../src/runtime/typed-client.js';
export { TypeSafeQueryBuilder } from '../src/runtime/typed-query-builder.js';

// Type aliases for better developer experience
export type ValidFieldNames = FieldPaths<GeneratedRecord>;
export type DatabaseClient = typeof db;
`;
  }

  /**
   * Get the relative path from the generated client to the database directory
   */
  private getRelativeDatabasePath(): string {
    // Since the client.ts is generated in the output directory,
    // and the database files are in the same directory, use '.'
    return '.';
  }
}
