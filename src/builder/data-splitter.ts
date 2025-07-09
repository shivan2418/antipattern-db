import * as fs from 'fs';
import * as path from 'path';
import { Buffer } from 'buffer';

export interface SplitterOptions {
  outputDir: string;
  primaryKeyField?: string; // Field to use as record ID (defaults to 'id')
  maxFileSize?: number; // Max size per file in bytes (for batching)
  batchSize?: number; // Number of records per batch file
  useSubdirectories?: boolean; // Split into subdirectories for better organization
  compressionLevel?: number; // 0-9, 0 = no compression
  filenameTemplate?: string; // Template for file naming
}

export interface SplitResult {
  totalRecords: number;
  totalFiles: number;
  totalSize: number;
  recordMap: Map<string, string>; // recordId -> filename
  metadata: SplitMetadata;
}

export interface SplitMetadata {
  totalRecords: number;
  totalFiles: number;
  avgFileSize: number;
  primaryKeyField: string;
  batchSize?: number;
  useSubdirectories: boolean;
  createdAt: string;
  files: FileMetadata[];
}

export interface FileMetadata {
  filename: string;
  recordCount: number;
  size: number;
  recordIds: string[];
  subdirectory?: string;
}

export class DataSplitter {
  private options: SplitterOptions;

  constructor(options: SplitterOptions) {
    this.options = {
      primaryKeyField: 'id',
      maxFileSize: 1024 * 1024, // 1MB default
      batchSize: 100, // 100 records per file default
      useSubdirectories: true,
      compressionLevel: 0,
      filenameTemplate: '{id}',
      ...options,
    };
  }

  /**
   * Split a collection of records into individual or batched files
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  splitRecords(records: any[]): SplitResult {
    // eslint-disable-next-line no-console
    console.log(`📂 Splitting ${records.length} records into files...`);

    // Validate records and primary key field
    this.validateRecords(records);

    const dataDir = path.join(this.options.outputDir, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const primaryKeyField = this.options.primaryKeyField!;
    const recordMap = new Map<string, string>();
    const fileMetadata: FileMetadata[] = [];
    let totalSize = 0;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (this.options.batchSize && this.options.batchSize! > 1) {
      // Batch mode: multiple records per file
      const result = this.splitIntoBatches(records, dataDir, primaryKeyField);
      result.files.forEach(file => {
        file.recordIds.forEach(recordId => {
          recordMap.set(recordId, file.filename);
        });
        fileMetadata.push(file);
        totalSize += file.size;
      });
    } else {
      // Individual mode: one record per file
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const recordId = record[primaryKeyField];

        const { filename, size } = this.writeRecordFile(record, recordId, dataDir, i);
        recordMap.set(recordId, filename);

        fileMetadata.push({
          filename,
          recordCount: 1,
          size,
          recordIds: [recordId],
          subdirectory: this.options.useSubdirectories ? this.getSubdirectory(i) : undefined,
        });

        totalSize += size;

        if (i % 1000 === 0) {
          // eslint-disable-next-line no-console
          console.log(`  📄 Processed ${i + 1}/${records.length} records`);
        }
      }
    }

    // Generate split metadata
    const metadata: SplitMetadata = {
      totalRecords: records.length,
      totalFiles: fileMetadata.length,
      avgFileSize: totalSize / fileMetadata.length,
      primaryKeyField,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      batchSize: this.options.batchSize! > 1 ? this.options.batchSize : undefined,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      useSubdirectories: this.options.useSubdirectories!,
      createdAt: new Date().toISOString(),
      files: fileMetadata,
    };

    // Write metadata file
    fs.writeFileSync(
      path.join(this.options.outputDir, 'split-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // eslint-disable-next-line no-console
    console.log(`✅ Split ${records.length} records into ${fileMetadata.length} files`);
    // eslint-disable-next-line no-console
    console.log(`   Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    // eslint-disable-next-line no-console
    console.log(`   Average file size: ${(metadata.avgFileSize / 1024).toFixed(2)} KB`);

    return {
      totalRecords: records.length,
      totalFiles: fileMetadata.length,
      totalSize,
      recordMap,
      metadata,
    };
  }

  /**
   * Split records into batch files
   */
  private splitIntoBatches(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    records: any[],
    dataDir: string,
    primaryKeyField: string
  ): { files: FileMetadata[] } {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const batchSize = this.options.batchSize!;
    const files: FileMetadata[] = [];

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, Math.min(i + batchSize, records.length));
      const batchIndex = Math.floor(i / batchSize);

      const recordIds = batch.map(record => record[primaryKeyField]);

      const filename = this.generateBatchFilename(batchIndex);
      const subdirectory = this.options.useSubdirectories
        ? this.getBatchSubdirectory(batchIndex)
        : undefined;

      const fullPath = subdirectory
        ? path.join(dataDir, subdirectory, filename)
        : path.join(dataDir, filename);

      // Create subdirectory if needed
      if (subdirectory) {
        const subdirPath = path.join(dataDir, subdirectory);
        if (!fs.existsSync(subdirPath)) {
          fs.mkdirSync(subdirPath, { recursive: true });
        }
      }

      // Write batch file
      const content = JSON.stringify(batch, null, 2);
      fs.writeFileSync(fullPath, content);

      const relativePath = subdirectory ? path.join(subdirectory, filename) : filename;

      files.push({
        filename: relativePath,
        recordCount: batch.length,
        size: Buffer.byteLength(content, 'utf8'),
        recordIds,
        subdirectory,
      });
    }

    return { files };
  }

  /**
   * Write a single record to file
   */
  private writeRecordFile(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    record: any,
    recordId: unknown,
    dataDir: string,
    index: number
  ): { filename: string; size: number } {
    const filename = this.generateFilename(recordId, index);
    const subdirectory = this.options.useSubdirectories ? this.getSubdirectory(index) : undefined;

    const fullPath = subdirectory
      ? path.join(dataDir, subdirectory, filename)
      : path.join(dataDir, filename);

    // Create subdirectory if needed
    if (subdirectory) {
      const subdirPath = path.join(dataDir, subdirectory);
      if (!fs.existsSync(subdirPath)) {
        fs.mkdirSync(subdirPath, { recursive: true });
      }
    }

    const content = JSON.stringify(record, null, 2);
    fs.writeFileSync(fullPath, content);

    const relativePath = subdirectory ? path.join(subdirectory, filename) : filename;

    return {
      filename: relativePath,
      size: Buffer.byteLength(content, 'utf8'),
    };
  }

  /**
   * Generate filename for a single record
   */
  private generateFilename(recordId: unknown, index: number): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (this.options.filenameTemplate!.includes('{id}')) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return `${this.options
        .filenameTemplate!.replace('{id}', this.sanitizeId(recordId))
        .replace('{index}', index.toString().padStart(6, '0'))}.json`;
    }

    // Default: use zero-padded index
    return `${index.toString().padStart(6, '0')}.json`;
  }

  /**
   * Generate filename for batch files
   */
  private generateBatchFilename(batchIndex: number): string {
    return `batch_${batchIndex.toString().padStart(4, '0')}.json`;
  }

  /**
   * Get subdirectory for a given record index
   */
  private getSubdirectory(index: number): string {
    // Split into subdirectories of 1000 files each
    const dirIndex = Math.floor(index / 1000);
    return dirIndex.toString().padStart(3, '0');
  }

  /**
   * Get subdirectory for a given batch index
   */
  private getBatchSubdirectory(batchIndex: number): string {
    // Split into subdirectories of 100 batch files each
    const dirIndex = Math.floor(batchIndex / 100);
    return `batches_${dirIndex.toString().padStart(3, '0')}`;
  }

  /**
   * Sanitize record ID for use in filename
   */
  private sanitizeId(id: unknown): string {
    // Convert any value to string first
    const idString = String(id);

    return idString
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50); // Limit length
  }

  /**
   * Extract records from various JSON structures
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static extractRecords(data: unknown): any[] {
    if (Array.isArray(data)) {
      return data;
    } else if (typeof data === 'object' && data !== null) {
      // Find the largest array property
      const dataObj = data as Record<string, unknown>;
      const arrayProps = Object.keys(dataObj).filter(key => Array.isArray(dataObj[key]));

      if (arrayProps.length > 0) {
        const largest = arrayProps.reduce((max, prop) =>
          (dataObj[prop] as unknown[]).length > (dataObj[max] as unknown[]).length ? prop : max
        );

        // eslint-disable-next-line no-console
        console.log(
          `📋 Using collection: ${largest} (${(dataObj[largest] as unknown[]).length} records)`
        );
        return dataObj[largest] as unknown[];
      }

      return [data];
    }

    return [];
  }

  /**
   * Validate records and primary key field
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private validateRecords(records: any[]): void {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const primaryKeyField = this.options.primaryKeyField!;

    if (!records.length) {
      throw new Error('No records to split.');
    }

    if (!records.every(record => Object.prototype.hasOwnProperty.call(record, primaryKeyField))) {
      throw new Error(`All records must have a "${primaryKeyField}" field.`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const primaryKeyValues = new Set<any>();
    for (const record of records) {
      const recordId = record[primaryKeyField];
      if (primaryKeyValues.has(recordId)) {
        throw new Error(`Duplicate primary key value found: ${recordId}`);
      }
      primaryKeyValues.add(recordId);
    }

    // eslint-disable-next-line no-console
    console.log(`  ✅ Primary key field "${primaryKeyField}" is valid.`);
    // eslint-disable-next-line no-console
    console.log(`  ✅ All records have unique primary key values.`);
  }
}
