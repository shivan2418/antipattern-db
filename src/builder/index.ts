import * as fs from 'fs';
import * as path from 'path';
import JSONToZodGenerator from '../jsontozod.js';
import { IndexGenerator, type IndexMetadata } from './index-generator.js';
import { DataSplitter } from './data-splitter.js';
import { ClientGenerator } from './client-generator.js';

export interface BuilderOptions {
  outputDir: string;

  // Schema generation options
  sampleSize?: number;
  enumThreshold?: number;
  optionalThreshold?: number;

  // Index generation options
  indexFields?: string[];
  maxIndexValues?: number;

  // Data splitting options
  primaryKeyField?: string;
  batchSize?: number;
  useSubdirectories?: boolean;

  // General options
  verbose?: boolean;
}

export interface BuildResult {
  totalRecords: number;
  totalFiles: number;
  totalIndexes: number;
  schemaGenerated: boolean;
  outputSize: number;
  buildTime: number;
  summary: {
    records: number;
    dataFiles: number;
    indexFiles: number;
    schemas: number;
    totalSizeMB: number;
  };
}

export class AntipatternBuilder {
  private options: BuilderOptions;

  constructor(options: BuilderOptions) {
    this.options = {
      sampleSize: 1000,
      enumThreshold: 20,
      optionalThreshold: 0.5,
      maxIndexValues: 10000,
      primaryKeyField: 'id',
      batchSize: 1, // Individual files by default
      useSubdirectories: true,
      verbose: true,
      ...options,
    };
  }

  /**
   * Build a complete static file database from a JSON file
   */
  async build(inputPath: string): Promise<BuildResult> {
    const startTime = Date.now();

    if (this.options.verbose) {
      console.log(`🚀 Building static database from ${inputPath}...`);
      console.log(`📁 Output directory: ${this.options.outputDir}`);
    }

    // Create output directory
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    // Step 1: Read and extract records
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const records = this.extractRecords(data);

    if (this.options.verbose) {
      console.log(`📊 Found ${records.length} records to process`);
    }

    // Step 2: Generate schemas
    const schemaGenerator = new JSONToZodGenerator({
      sampleSize: this.options.sampleSize,
      enumThreshold: this.options.enumThreshold,
      optionalThreshold: this.options.optionalThreshold,
    });

    await schemaGenerator.generateFromFile(inputPath, this.options.outputDir);

    // Step 3: Split data into files
    const splitter = new DataSplitter({
      outputDir: this.options.outputDir,
      primaryKeyField: this.options.primaryKeyField,
      batchSize: this.options.batchSize,
      useSubdirectories: this.options.useSubdirectories,
    });

    const splitResult = await splitter.splitRecords(records);

    // Step 4: Generate indexes
    const indexGenerator = new IndexGenerator({
      outputDir: this.options.outputDir,
      indexFields: this.options.indexFields,
      maxIndexValues: this.options.maxIndexValues,
    });

    await indexGenerator.generateIndexes(records, this.options.primaryKeyField);

    // Step 5: Generate type-safe database client
    const clientGenerator = new ClientGenerator({
      outputDir: this.options.outputDir,
      primaryKeyField: this.options.primaryKeyField,
    });

    await clientGenerator.generateClient();

    // Calculate total output size
    const outputSize = this.calculateOutputSize(this.options.outputDir);
    const buildTime = Date.now() - startTime;

    // Generate build summary
    const summary = {
      records: records.length,
      dataFiles: splitResult.totalFiles,
      indexFiles: this.countIndexFiles(),
      schemas: 4, // schema.ts, types.ts, index.ts, client.ts
      totalSizeMB: Math.round((outputSize / 1024 / 1024) * 100) / 100,
    };

    if (this.options.verbose) {
      this.printBuildSummary(summary, buildTime);
    }

    // Write build manifest
    await this.generateBuildManifest(summary, buildTime, inputPath);

    return {
      totalRecords: records.length,
      totalFiles: splitResult.totalFiles,
      totalIndexes: summary.indexFiles,
      schemaGenerated: true,
      outputSize,
      buildTime,
      summary,
    };
  }

  /**
   * Validate an existing database
   */
  async validate(outputDir?: string): Promise<boolean> {
    const dbDir = outputDir || this.options.outputDir;

    console.log(`🔍 Validating database at ${dbDir}...`);

    try {
      // Check required files
      const requiredFiles = [
        'schema.ts',
        'types.ts',
        'index.ts',
        'client.ts',
        'metadata.json',
        'split-metadata.json',
      ];

      for (const file of requiredFiles) {
        const filePath = path.join(dbDir, file);
        if (!fs.existsSync(filePath)) {
          console.error(`❌ Missing required file: ${file}`);
          return false;
        }
      }

      // Check directories
      const requiredDirs = ['data', 'indexes'];
      for (const dir of requiredDirs) {
        const dirPath = path.join(dbDir, dir);
        if (!fs.existsSync(dirPath)) {
          console.error(`❌ Missing required directory: ${dir}`);
          return false;
        }
      }

      // Validate metadata consistency
      const metadata = JSON.parse(fs.readFileSync(path.join(dbDir, 'metadata.json'), 'utf8'));
      const splitMetadata = JSON.parse(
        fs.readFileSync(path.join(dbDir, 'split-metadata.json'), 'utf8')
      );

      if (metadata.totalRecords !== splitMetadata.totalRecords) {
        console.error(
          `❌ Record count mismatch: metadata=${metadata.totalRecords}, split=${splitMetadata.totalRecords}`
        );
        return false;
      }

      console.log(`✅ Database validation passed`);
      console.log(`   Records: ${metadata.totalRecords}`);
      console.log(`   Indexes: ${metadata.indexes.length}`);
      console.log(`   Data files: ${splitMetadata.totalFiles}`);

      return true;
    } catch (error) {
      console.error(`❌ Validation failed:`, error);
      return false;
    }
  }

  /**
   * Get database info
   */
  async info(outputDir?: string): Promise<any> {
    const dbDir = outputDir || this.options.outputDir;

    try {
      const metadata = JSON.parse(fs.readFileSync(path.join(dbDir, 'metadata.json'), 'utf8'));
      const splitMetadata = JSON.parse(
        fs.readFileSync(path.join(dbDir, 'split-metadata.json'), 'utf8')
      );

      let buildManifest = null;
      const manifestPath = path.join(dbDir, 'build-manifest.json');
      if (fs.existsSync(manifestPath)) {
        buildManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      }

      return {
        database: {
          totalRecords: metadata.totalRecords,
          totalFields: metadata.fields.length,
          totalIndexes: metadata.indexes.length,
          createdAt: metadata.createdAt,
          version: metadata.version,
        },
        data: {
          totalFiles: splitMetadata.totalFiles,
          avgFileSize: Math.round(splitMetadata.avgFileSize),
          useSubdirectories: splitMetadata.useSubdirectories,
          batchSize: splitMetadata.batchSize,
        },
        build: buildManifest,
        indexes: metadata.indexes.map((idx: IndexMetadata) => ({
          field: idx.field,
          type: idx.type,
          uniqueValues: idx.uniqueValues,
          coverage: `${Math.round(idx.coverage * 100)}%`,
        })),
      };
    } catch (error) {
      throw new Error(`Failed to read database info: ${error}`);
    }
  }

  /**
   * Extract records from various JSON structures
   */
  private extractRecords(data: unknown): any[] {
    return DataSplitter.extractRecords(data);
  }

  /**
   * Calculate total output size
   */
  private calculateOutputSize(dir: string): number {
    let totalSize = 0;

    const calculateDir = (dirPath: string) => {
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          calculateDir(itemPath);
        } else {
          totalSize += stat.size;
        }
      }
    };

    calculateDir(dir);
    return totalSize;
  }

  /**
   * Count index files
   */
  private countIndexFiles(): number {
    const indexesDir = path.join(this.options.outputDir, 'indexes');
    if (!fs.existsSync(indexesDir)) return 0;

    return fs.readdirSync(indexesDir).filter(file => file.endsWith('.json')).length;
  }

  /**
   * Print build summary
   */
  private printBuildSummary(summary: any, buildTime: number): void {
    console.log(`\n🎉 Build completed successfully!`);
    console.log(`⏱️  Build time: ${buildTime}ms`);
    console.log(`📊 Summary:`);
    console.log(`   Records: ${summary.records.toLocaleString()}`);
    console.log(`   Data files: ${summary.dataFiles.toLocaleString()}`);
    console.log(`   Index files: ${summary.indexFiles}`);
    console.log(`   Schema files: ${summary.schemas}`);
    console.log(`   Total size: ${summary.totalSizeMB} MB`);
    console.log(`\n📁 Output structure:`);
    console.log(`   ${this.options.outputDir}/`);
    console.log(`   ├── schema.ts           # Zod schemas`);
    console.log(`   ├── types.ts            # TypeScript types`);
    console.log(`   ├── index.ts            # Exports`);
    console.log(`   ├── metadata.json       # Database metadata`);
    console.log(`   ├── split-metadata.json # Data split info`);
    console.log(`   ├── data/               # Record files`);
    console.log(`   └── indexes/            # Query indexes`);
  }

  /**
   * Generate build manifest
   */
  private async generateBuildManifest(
    summary: any,
    buildTime: number,
    inputPath: string
  ): Promise<void> {
    const manifest = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      buildTime,
      inputFile: path.basename(inputPath),
      options: {
        sampleSize: this.options.sampleSize,
        enumThreshold: this.options.enumThreshold,
        optionalThreshold: this.options.optionalThreshold,
        maxIndexValues: this.options.maxIndexValues,
        primaryKeyField: this.options.primaryKeyField,
        batchSize: this.options.batchSize,
        useSubdirectories: this.options.useSubdirectories,
      },
      summary,
    };

    fs.writeFileSync(
      path.join(this.options.outputDir, 'build-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
  }
}
