#!/usr/bin/env node

import { program } from 'commander';
import { AntipatternBuilder } from '../builder/index.js';
import * as fs from 'fs';

program
  .name('antipattern-db')
  .description('Convert JSON files into type-safe, queryable static file databases')
  .version('1.0.0');

program
  .command('build <input-file>')
  .description('Build a complete static file database from a JSON file')
  .option('-o, --output <dir>', 'Output directory', './db')
  .option('-p, --primary-key <field>', 'Primary key field', 'id')
  .option('-b, --batch-size <size>', 'Records per file (1 = individual files)', '1')
  .option('-i, --index-fields <fields>', 'Comma-separated list of fields to index (default: all)')
  .option('--max-index-values <count>', 'Skip indexing fields with more unique values', '10000')
  .option('--sample-size <size>', 'Number of records to analyze for schema', '1000')
  .option('--enum-threshold <count>', 'Max unique values for enum generation', '20')
  .option('--optional-threshold <ratio>', 'Threshold for optional fields (0-1)', '0.5')
  .option('--no-subdirectories', 'Disable subdirectory organization')
  .option('-q, --quiet', 'Suppress verbose output')
  .action(async (inputFile: string, options: any) => {
    try {
      // Validate input file
      if (!fs.existsSync(inputFile)) {
        console.error(`❌ Input file not found: ${inputFile}`);
        process.exit(1);
      }

      // Parse options
      const indexFields = options.indexFields
        ? options.indexFields.split(',').map((f: string) => f.trim())
        : undefined;

      const builder = new AntipatternBuilder({
        outputDir: options.output,
        primaryKeyField: options.primaryKey,
        batchSize: parseInt(options.batchSize),
        indexFields,
        maxIndexValues: parseInt(options.maxIndexValues),
        enumThreshold: parseInt(options.enumThreshold),
        optionalThreshold: parseFloat(options.optionalThreshold),
        useSubdirectories: !options.noSubdirectories,
        verbose: !options.quiet,
      });

      console.log(`🚀 Building database from ${inputFile}...`);

      const result = await builder.build(inputFile);

      console.log(`\n✅ Database built successfully!`);
      console.log(`📁 Output: ${options.output}`);
      console.log(`📊 Records: ${result.totalRecords.toLocaleString()}`);
      console.log(`📄 Files: ${result.totalFiles.toLocaleString()}`);
      console.log(`📇 Indexes: ${result.totalIndexes}`);
      console.log(`⏱️  Build time: ${result.buildTime}ms`);
      console.log(`💾 Size: ${result.summary.totalSizeMB} MB`);

      console.log(`\n🎯 Usage:`);
      console.log(`   import { db } from '${options.output}';`);
      console.log(`   await db.init();`);
      console.log(`   const results = await db.query().where('field').equals('value').exec();`);
    } catch (error) {
      console.error(`❌ Build failed:`, error);
      process.exit(1);
    }
  });

program
  .command('validate <database-dir>')
  .description('Validate a database directory')
  .action(async (databaseDir: string) => {
    try {
      const builder = new AntipatternBuilder({ outputDir: databaseDir });
      const isValid = await builder.validate();

      if (isValid) {
        console.log(`✅ Database validation passed`);
        process.exit(0);
      } else {
        console.log(`❌ Database validation failed`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Validation error:`, error);
      process.exit(1);
    }
  });

program
  .command('info <database-dir>')
  .description('Show database information')
  .action(async (databaseDir: string) => {
    try {
      const builder = new AntipatternBuilder({ outputDir: databaseDir });
      const info = await builder.info();

      console.log(`📊 Database Information`);
      console.log(`🗄️  Database:`);
      console.log(`   Records: ${info.database.totalRecords.toLocaleString()}`);
      console.log(`   Fields: ${info.database.totalFields}`);
      console.log(`   Indexes: ${info.database.totalIndexes}`);
      console.log(`   Created: ${new Date(info.database.createdAt).toLocaleString()}`);

      console.log(`📁 Data Files:`);
      console.log(`   Total files: ${info.data.totalFiles.toLocaleString()}`);
      console.log(`   Avg file size: ${info.data.avgFileSize} bytes`);
      console.log(`   Batch size: ${info.data.batchSize}`);
      console.log(`   Subdirectories: ${info.data.useSubdirectories ? 'Yes' : 'No'}`);

      if (info.indexes.length > 0) {
        console.log(`📇 Indexes:`);
        info.indexes.forEach((idx: any) => {
          console.log(`   ${idx.field}: ${idx.uniqueValues} values (${idx.coverage} coverage)`);
        });
      }

      if (info.build) {
        console.log(`🔨 Build Info:`);
        console.log(`   Build time: ${info.build.buildTime}ms`);
        console.log(`   Input file: ${info.build.inputFile}`);
      }
    } catch (error) {
      console.error(`❌ Failed to get database info:`, error);
      process.exit(1);
    }
  });

// Quick build command (legacy compatibility)
program
  .command('generate <input-file> [output-dir]')
  .description('Generate database (alias for build)')
  .action(async (inputFile: string, outputDir: string = './db') => {
    try {
      const builder = new AntipatternBuilder({
        outputDir,
        verbose: true,
      });

      await builder.build(inputFile);
      console.log(`✅ Database generated in ${outputDir}`);
    } catch (error) {
      console.error(`❌ Generation failed:`, error);
      process.exit(1);
    }
  });

// Error handling
program.exitOverride();

try {
  program.parse();
} catch (err: any) {
  if (err.code === 'commander.help' || err.code === 'commander.version') {
    process.exit(0);
  } else {
    console.error('❌ CLI Error:', err.message);
    process.exit(1);
  }
}
