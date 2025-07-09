import * as fs from 'fs';
import * as path from 'path';

export interface IndexOptions {
  outputDir: string;
  indexFields?: string[]; // If specified, only index these fields
  maxIndexValues?: number; // Skip indexing fields with too many unique values
  compressIndexes?: boolean; // Whether to compress index files
}

export interface IndexEntry {
  value: unknown;
  recordIds: string[];
}

export interface IndexMetadata {
  field: string;
  type: 'primitive' | 'array' | 'nested';
  uniqueValues: number;
  totalRecords: number;
  coverage: number; // Percentage of records that have this field
  createdAt: string;
}

export interface DatabaseMetadata {
  totalRecords: number;
  indexes: IndexMetadata[];
  fields: string[];
  createdAt: string;
  version: string;
}

export class IndexGenerator {
  private options: IndexOptions;
  private fieldStats: Map<string, Map<unknown, Set<string>>>;
  private fieldMetadata: Map<string, { count: number; type: string }>;
  private totalRecords: number;

  constructor(options: IndexOptions) {
    this.options = {
      maxIndexValues: 10000, // Don't index fields with more than 10k unique values
      compressIndexes: false,
      ...options,
    };
    this.fieldStats = new Map();
    this.fieldMetadata = new Map();
    this.totalRecords = 0;
  }

  /**
   * Generate indexes from a collection of records
   */
  async generateIndexes(records: any[], primaryKeyField = 'id'): Promise<void> {
    console.log(`📊 Generating indexes for ${records.length} records...`);

    this.totalRecords = records.length;

    // Analyze records and build field statistics
    records.forEach((record, index) => {
      const recordId = record[primaryKeyField] || index.toString();
      this.analyzeRecord(record, recordId, '');
    });

    // Create output directories
    const indexesDir = path.join(this.options.outputDir, 'indexes');
    if (!fs.existsSync(indexesDir)) {
      fs.mkdirSync(indexesDir, { recursive: true });
    }

    // Generate indexes for each field
    const indexMetadata: IndexMetadata[] = [];

    for (const [fieldPath, valueMap] of this.fieldStats) {
      // Skip if field has too many unique values
      if (valueMap.size > this.options.maxIndexValues!) {
        console.log(`⚠️  Skipping index for ${fieldPath} (${valueMap.size} unique values)`);
        continue;
      }

      // Skip if only indexing specific fields
      if (this.options.indexFields && !this.options.indexFields.includes(fieldPath)) {
        continue;
      }

      const metadata = await this.generateFieldIndex(fieldPath, valueMap, indexesDir);
      indexMetadata.push(metadata);
    }

    // Generate primary key index (special case)
    await this.generatePrimaryKeyIndex(records, primaryKeyField, indexesDir);

    // Generate database metadata
    await this.generateDatabaseMetadata(indexMetadata);

    console.log(`✅ Generated ${indexMetadata.length + 1} indexes in ${indexesDir}/`);
  }

  /**
   * Recursively analyze a record to build field statistics
   */
  private analyzeRecord(record: any, recordId: string, prefix: string): void {
    if (typeof record !== 'object' || record === null) return;

    for (const [key, value] of Object.entries(record)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;

      if (!this.fieldStats.has(fieldPath)) {
        this.fieldStats.set(fieldPath, new Map());
      }

      if (!this.fieldMetadata.has(fieldPath)) {
        this.fieldMetadata.set(fieldPath, { count: 0, type: 'primitive' });
      }

      const stats = this.fieldStats.get(fieldPath)!;
      const metadata = this.fieldMetadata.get(fieldPath)!;
      metadata.count++;

      if (value === null || value === undefined) {
        this.addToIndex(stats, null, recordId);
        return;
      }

      if (Array.isArray(value)) {
        metadata.type = 'array';
        // Index each array element
        value.forEach(item => {
          if (this.isPrimitive(item)) {
            this.addToIndex(stats, item, recordId);
          }
        });

        // Also recursively analyze object elements in arrays
        value.forEach(item => {
          if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
            this.analyzeRecord(item, recordId, `${fieldPath}[]`);
          }
        });
      } else if (typeof value === 'object') {
        metadata.type = 'nested';
        // For nested objects, we don't index the object itself, just recurse
        this.analyzeRecord(value, recordId, fieldPath);
      } else {
        // Primitive value
        this.addToIndex(stats, value, recordId);
      }
    }
  }

  /**
   * Add a value to the index for a specific record
   */
  private addToIndex(stats: Map<unknown, Set<string>>, value: unknown, recordId: string): void {
    if (!stats.has(value)) {
      stats.set(value, new Set());
    }
    stats.get(value)!.add(recordId);
  }

  /**
   * Generate index file for a specific field
   */
  private async generateFieldIndex(
    fieldPath: string,
    valueMap: Map<unknown, Set<string>>,
    indexesDir: string
  ): Promise<IndexMetadata> {
    const indexEntries: IndexEntry[] = [];

    for (const [value, recordIds] of valueMap) {
      indexEntries.push({
        value,
        recordIds: Array.from(recordIds).sort(),
      });
    }

    // Sort by number of records (most common values first)
    indexEntries.sort((a, b) => b.recordIds.length - a.recordIds.length);

    const indexData = {
      field: fieldPath,
      entries: indexEntries,
      metadata: {
        uniqueValues: indexEntries.length,
        totalRecords: this.totalRecords,
        coverage: (this.fieldMetadata.get(fieldPath)?.count || 0) / this.totalRecords,
        createdAt: new Date().toISOString(),
      },
    };

    // Write index file
    const filename = `${this.sanitizeFieldName(fieldPath)}.json`;
    const filepath = path.join(indexesDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(indexData, null, 2));

    console.log(`  📝 Generated index for ${fieldPath} (${indexEntries.length} unique values)`);

    return {
      field: fieldPath,
      type: (this.fieldMetadata.get(fieldPath)?.type as any) || 'primitive',
      uniqueValues: indexEntries.length,
      totalRecords: this.totalRecords,
      coverage: indexData.metadata.coverage,
      createdAt: indexData.metadata.createdAt,
    };
  }

  /**
   * Generate primary key index for fast record lookup
   */
  private async generatePrimaryKeyIndex(
    records: any[],
    primaryKeyField: string,
    indexesDir: string
  ): Promise<void> {
    const primaryIndex = records.map((record, index) => ({
      id: record[primaryKeyField] || index.toString(),
      index,
    }));

    const indexData = {
      field: primaryKeyField,
      type: 'primary',
      entries: primaryIndex,
      metadata: {
        totalRecords: records.length,
        createdAt: new Date().toISOString(),
      },
    };

    fs.writeFileSync(path.join(indexesDir, '_primary.json'), JSON.stringify(indexData, null, 2));

    console.log(`  🔑 Generated primary key index for ${primaryKeyField}`);
  }

  /**
   * Generate database metadata file
   */
  private async generateDatabaseMetadata(indexMetadata: IndexMetadata[]): Promise<void> {
    const metadata: DatabaseMetadata = {
      totalRecords: this.totalRecords,
      indexes: indexMetadata,
      fields: Array.from(this.fieldStats.keys()).sort(),
      createdAt: new Date().toISOString(),
      version: '1.0.0',
    };

    fs.writeFileSync(
      path.join(this.options.outputDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`  📋 Generated database metadata`);
  }

  /**
   * Check if a value is primitive (indexable)
   */
  private isPrimitive(value: unknown): boolean {
    return (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    );
  }

  /**
   * Sanitize field names for use as filenames
   */
  private sanitizeFieldName(fieldName: string): string {
    return fieldName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  }
}
