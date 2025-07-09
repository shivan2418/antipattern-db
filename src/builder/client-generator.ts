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

    // Copy browser runtime files
    await this.copyBrowserRuntimeFiles();

    const clientContent = this.generateClientCode();
    const clientPath = path.join(this.options.outputDir, 'client.ts');

    fs.writeFileSync(clientPath, clientContent);

    console.log('  ✅ Generated type-safe database client');
  }

  /**
   * Copy browser runtime files to the output directory
   */
  private async copyBrowserRuntimeFiles(): Promise<void> {
    const runtimeFiles = [
      'browser-client.js',
      'browser-client.d.ts',
      'browser-typed-client.js',
      'browser-typed-client.d.ts',
      'typed-query-builder.js',
      'typed-query-builder.d.ts',
    ];

    // Find the path to the compiled runtime files using ES module syntax
    const currentFileUrl = new URL(import.meta.url);
    const currentDir = path.dirname(currentFileUrl.pathname);
    const srcRuntimePath = path.join(currentDir, '../runtime');

    for (const file of runtimeFiles) {
      const srcPath = path.join(srcRuntimePath, file);
      const destPath = path.join(this.options.outputDir, file);

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }

    // Fix the import in typed-query-builder files
    this.fixTypedQueryBuilderImports();
  }

  /**
   * Fix imports in the copied typed-query-builder files
   */
  private fixTypedQueryBuilderImports(): void {
    // Fix JavaScript file
    const jsPath = path.join(this.options.outputDir, 'typed-query-builder.js');
    if (fs.existsSync(jsPath)) {
      let content = fs.readFileSync(jsPath, 'utf8');
      content = content.replace("from './query-client.js'", "from './browser-client.js'");
      fs.writeFileSync(jsPath, content);
    }

    // Fix TypeScript declaration file
    const dtsPath = path.join(this.options.outputDir, 'typed-query-builder.d.ts');
    if (fs.existsSync(dtsPath)) {
      let content = fs.readFileSync(dtsPath, 'utf8');
      content = content.replace("from './query-client.js'", "from './browser-client.js'");
      fs.writeFileSync(dtsPath, content);
    }
  }

  private generateClientCode(): string {
    return `// Auto-generated database client
// This file provides a pre-configured, type-safe database client

import { BrowserTypedDatabaseClient } from './browser-typed-client.js';
import { type FieldPaths } from './typed-query-builder.js';
import { RecordSchema } from './schema.js';
import type { GeneratedRecord } from './types.js';

/**
 * Pre-configured, type-safe database client with field name constraints
 * 
 * Features:
 * - Field names are constrained to actual record properties
 * - Nested field access (e.g., 'profile.age') is supported up to 3 levels
 * - Compile-time error if you try to query non-existent fields
 * - Browser-compatible (uses fetch instead of fs)
 * 
 * Usage:
 *   import { db } from './client';
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
 * 
 * Note: For browser usage, make sure the database files are served as static assets.
 * The baseUrl should point to the directory containing the generated database files.
 */
export const db = new BrowserTypedDatabaseClient<GeneratedRecord, typeof RecordSchema>(
  './',  // Base URL for fetching database files
  RecordSchema
);

// Re-export types for convenience
export type { GeneratedRecord } from './types.js';
export { RecordSchema } from './schema.js';
export { BrowserTypedDatabaseClient } from './browser-typed-client.js';
export { TypeSafeQueryBuilder } from './typed-query-builder.js';

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
