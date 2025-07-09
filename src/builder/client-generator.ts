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

import { createTypedClient } from '../src/runtime/typed-client.js';
import { RecordSchema } from './schema.js';
import type { GeneratedRecord } from './types.js';

/**
 * Pre-configured, type-safe database client
 * Usage: import { db } from './database';
 */
export const db = createTypedClient<GeneratedRecord, typeof RecordSchema>(
  import.meta.dirname || '.',
  RecordSchema
);

// Re-export types for convenience
export type { GeneratedRecord } from './types.js';
export { RecordSchema } from './schema.js';
export { TypedDatabaseClient } from '../src/runtime/typed-client.js';
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
