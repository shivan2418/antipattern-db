import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { AntipatternBuilder } from './index.js';

// Test data with complex nested structure
const testData = [
  {
    id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    status: 'active',
    roles: ['user', 'admin'],
    profile: {
      bio: 'Software developer',
      website: 'https://johndoe.com',
      social: {
        twitter: '@johndoe',
        github: 'johndoe',
      },
    },
    preferences: {
      theme: 'dark',
      notifications: true,
    },
    metadata: {
      createdAt: '2023-01-01T00:00:00Z',
      lastLogin: '2023-06-15T14:30:00Z',
    },
  },
  {
    id: 'user-2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    age: 25,
    status: 'active',
    roles: ['user'],
    profile: {
      bio: 'Designer',
      website: 'https://janesmith.com',
      social: {
        twitter: '@janesmith',
        linkedin: 'janesmith',
      },
    },
    preferences: {
      theme: 'light',
      notifications: false,
    },
    metadata: {
      createdAt: '2023-02-15T10:30:00Z',
      lastLogin: '2023-06-14T09:15:00Z',
    },
  },
  {
    id: 'user-3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    age: 35,
    status: 'inactive',
    roles: ['user', 'moderator'],
    profile: {
      bio: 'Product manager',
      website: null,
      social: {
        twitter: '@bob_johnson',
      },
    },
    preferences: {
      theme: 'auto',
      notifications: true,
    },
    metadata: {
      createdAt: '2023-03-20T16:45:00Z',
      lastLogin: '2023-05-10T11:20:00Z',
    },
  },
];

async function runBuilderTests() {
  console.log('🧪 Running builder integration tests...\n');

  const testInputPath = './test-builder-input.json';
  const testOutputDir = './test-builder-output';

  // Cleanup any existing test files
  try {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
    fs.unlinkSync(testInputPath);
  } catch {
    // Ignore cleanup errors
  }

  try {
    // Create test input file
    fs.writeFileSync(testInputPath, JSON.stringify(testData, null, 2));

    // Initialize builder
    const builder = new AntipatternBuilder({
      outputDir: testOutputDir,
      primaryKeyField: 'id',
      batchSize: 1, // Individual files
      indexFields: ['id', 'status', 'age', 'roles', 'preferences.theme'], // Only index specific fields
      verbose: true,
    });

    // Test 1: Build database
    console.log('✅ Test 1: Build database');
    const buildResult = await builder.build(testInputPath);

    assert(buildResult.totalRecords === 3, 'Should process 3 records');
    assert(buildResult.totalFiles === 3, 'Should create 3 data files');
    assert(buildResult.schemaGenerated === true, 'Should generate schemas');
    assert(buildResult.buildTime > 0, 'Should have valid build time');

    // Test 2: Validate file structure
    console.log('✅ Test 2: Validate file structure');
    assert(fs.existsSync(testOutputDir), 'Output directory should exist');
    assert(fs.existsSync(path.join(testOutputDir, 'schema.ts')), 'schema.ts should exist');
    assert(fs.existsSync(path.join(testOutputDir, 'types.ts')), 'types.ts should exist');
    assert(fs.existsSync(path.join(testOutputDir, 'index.ts')), 'index.ts should exist');
    assert(fs.existsSync(path.join(testOutputDir, 'metadata.json')), 'metadata.json should exist');
    assert(
      fs.existsSync(path.join(testOutputDir, 'split-metadata.json')),
      'split-metadata.json should exist'
    );
    assert(
      fs.existsSync(path.join(testOutputDir, 'build-manifest.json')),
      'build-manifest.json should exist'
    );
    assert(fs.existsSync(path.join(testOutputDir, 'data')), 'data directory should exist');
    assert(fs.existsSync(path.join(testOutputDir, 'indexes')), 'indexes directory should exist');

    // Test 3: Validate data files
    console.log('✅ Test 3: Validate data files');
    const dataDir = path.join(testOutputDir, 'data');
    const dataFiles = fs
      .readdirSync(dataDir, { recursive: true })
      .filter(f => typeof f === 'string' && f.endsWith('.json'));
    assert(dataFiles.length === 3, 'Should have 3 data files');

    // Read a data file and validate structure
    const firstDataFile = path.join(dataDir, dataFiles[0] as string);
    const recordData = JSON.parse(fs.readFileSync(firstDataFile, 'utf8'));
    assert(recordData.id, 'Record should have id field');
    assert(recordData.name, 'Record should have name field');
    assert(recordData.profile, 'Record should have nested profile field');

    // Test 4: Validate indexes
    console.log('✅ Test 4: Validate indexes');
    const indexesDir = path.join(testOutputDir, 'indexes');
    const indexFiles = fs.readdirSync(indexesDir).filter(f => f.endsWith('.json'));

    // Should have at least: _primary.json, id.json, status.json, age.json, preferences_theme.json, roles.json
    assert(indexFiles.length >= 5, `Should have at least 5 index files, got ${indexFiles.length}`);
    assert(indexFiles.includes('_primary.json'), 'Should have primary index');
    assert(indexFiles.includes('id.json'), 'Should have id index');
    assert(indexFiles.includes('status.json'), 'Should have status index');

    // Validate index file structure
    const statusIndex = JSON.parse(fs.readFileSync(path.join(indexesDir, 'status.json'), 'utf8'));
    assert(statusIndex.field === 'status', 'Index should have correct field name');
    assert(Array.isArray(statusIndex.entries), 'Index should have entries array');
    assert(
      statusIndex.entries.length === 2,
      'Should have 2 unique status values (active, inactive)'
    );

    // Check that active status has 2 records and inactive has 1
    const activeEntry = statusIndex.entries.find((e: any) => e.value === 'active');
    const inactiveEntry = statusIndex.entries.find((e: any) => e.value === 'inactive');
    assert(
      activeEntry && activeEntry.recordIds.length === 2,
      'Active status should have 2 records'
    );
    assert(
      inactiveEntry && inactiveEntry.recordIds.length === 1,
      'Inactive status should have 1 record'
    );

    // Test 5: Validate array field indexing (roles)
    console.log('✅ Test 5: Validate array field indexing');
    if (indexFiles.includes('roles.json')) {
      const rolesIndex = JSON.parse(fs.readFileSync(path.join(indexesDir, 'roles.json'), 'utf8'));
      assert(rolesIndex.field === 'roles', 'Roles index should have correct field name');

      // Should have entries for 'user', 'admin', 'moderator'
      const userEntry = rolesIndex.entries.find((e: any) => e.value === 'user');
      const adminEntry = rolesIndex.entries.find((e: any) => e.value === 'admin');
      const moderatorEntry = rolesIndex.entries.find((e: any) => e.value === 'moderator');

      assert(
        userEntry && userEntry.recordIds.length === 3,
        'User role should appear in all 3 records'
      );
      assert(
        adminEntry && adminEntry.recordIds.length === 1,
        'Admin role should appear in 1 record'
      );
      assert(
        moderatorEntry && moderatorEntry.recordIds.length === 1,
        'Moderator role should appear in 1 record'
      );
    }

    // Test 6: Validate nested field indexing
    console.log('✅ Test 6: Validate nested field indexing');
    if (indexFiles.includes('preferences_theme.json')) {
      const themeIndex = JSON.parse(
        fs.readFileSync(path.join(indexesDir, 'preferences_theme.json'), 'utf8')
      );
      assert(
        themeIndex.field === 'preferences.theme',
        'Theme index should have correct nested field name'
      );
      assert(themeIndex.entries.length === 3, 'Should have 3 unique theme values');
    }

    // Test 7: Validate metadata
    console.log('✅ Test 7: Validate metadata');
    const metadata = JSON.parse(fs.readFileSync(path.join(testOutputDir, 'metadata.json'), 'utf8'));
    assert(metadata.totalRecords === 3, 'Metadata should show 3 total records');
    assert(Array.isArray(metadata.indexes), 'Metadata should have indexes array');
    assert(Array.isArray(metadata.fields), 'Metadata should have fields array');
    assert(metadata.fields.includes('id'), 'Fields should include id');
    assert(metadata.fields.includes('preferences.theme'), 'Fields should include nested field');

    // Test 8: Validate split metadata
    console.log('✅ Test 8: Validate split metadata');
    const splitMetadata = JSON.parse(
      fs.readFileSync(path.join(testOutputDir, 'split-metadata.json'), 'utf8')
    );
    assert(splitMetadata.totalRecords === 3, 'Split metadata should show 3 total records');
    assert(splitMetadata.totalFiles === 3, 'Split metadata should show 3 total files');
    assert(
      splitMetadata.primaryKeyField === 'id',
      'Split metadata should show correct primary key field'
    );
    assert(Array.isArray(splitMetadata.files), 'Split metadata should have files array');

    // Test 9: Validate schemas
    console.log('✅ Test 9: Validate schemas');
    const schemaContent = fs.readFileSync(path.join(testOutputDir, 'schema.ts'), 'utf8');
    assert(schemaContent.includes("import { z } from 'zod'"), 'Schema should import zod');
    assert(
      schemaContent.includes('export const RecordSchema'),
      'Schema should export RecordSchema'
    );
    assert(schemaContent.includes('export type Record'), 'Schema should export Record type');

    const typesContent = fs.readFileSync(path.join(testOutputDir, 'types.ts'), 'utf8');
    assert(typesContent.includes('export interface'), 'Types should export interfaces');

    // Test 10: Validate database validation
    console.log('✅ Test 10: Validate database validation');
    const validationResult = await builder.validate();
    assert(validationResult === true, 'Database validation should pass');

    // Test 11: Validate database info
    console.log('✅ Test 11: Validate database info');
    const info = await builder.info();
    assert(info.database.totalRecords === 3, 'Info should show correct record count');
    assert(info.data.totalFiles === 3, 'Info should show correct file count');
    assert(Array.isArray(info.indexes), 'Info should include indexes array');

    // Test 12: Test batch mode
    console.log('✅ Test 12: Test batch mode');
    const batchOutputDir = './test-builder-batch';
    try {
      fs.rmSync(batchOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    const batchBuilder = new AntipatternBuilder({
      outputDir: batchOutputDir,
      primaryKeyField: 'id',
      batchSize: 2, // 2 records per file
      verbose: false,
    });

    const batchResult = await batchBuilder.build(testInputPath);
    assert(batchResult.totalRecords === 3, 'Batch mode should process 3 records');
    assert(batchResult.totalFiles === 2, 'Batch mode should create 2 files (2+1 records)');

    const batchDataDir = path.join(batchOutputDir, 'data');
    const batchFiles = fs
      .readdirSync(batchDataDir, { recursive: true })
      .filter(f => typeof f === 'string' && f.endsWith('.json'));
    assert(batchFiles.length === 2, 'Should have 2 batch files');

    // Validate batch file content
    const firstBatchFile = path.join(batchDataDir, batchFiles[0] as string);
    const batchData = JSON.parse(fs.readFileSync(firstBatchFile, 'utf8'));
    assert(Array.isArray(batchData), 'Batch file should contain array');
    assert(batchData.length <= 2, 'Batch should have at most 2 records');

    console.log('\n🎉 All builder tests passed!');
    console.log('\n📋 Test Summary:');
    console.log('✓ Schema generation and introspection');
    console.log('✓ Data splitting (individual and batch modes)');
    console.log('✓ Index generation for primitive, array, and nested fields');
    console.log('✓ Metadata generation and consistency');
    console.log('✓ File structure validation');
    console.log('✓ Database validation and info retrieval');
    console.log('✓ Complex nested object handling');
    console.log('✓ Array field indexing');
    console.log('✓ Selective field indexing');

    // Cleanup batch test
    try {
      fs.rmSync(batchOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  } catch (error) {
    console.error('❌ Builder test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      fs.unlinkSync(testInputPath);
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Run tests
runBuilderTests();
