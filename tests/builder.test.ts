import { test, describe, before, after } from 'node:test';
import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { AntipatternBuilder } from '../src/builder/index.js';
import { DataSplitter } from '../src/builder/data-splitter.js';

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

describe('Builder Tests', () => {
  const testInputPath = './test-builder-input.json';
  const testOutputDir = './test-builder-output';
  const testBatchDir = './test-builder-batch';
  let builder: AntipatternBuilder;

  before(() => {
    // Cleanup any existing test files
    try {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
      fs.rmSync(testBatchDir, { recursive: true, force: true });
      if (fs.existsSync(testInputPath)) {
        fs.unlinkSync(testInputPath);
      }
    } catch {
      // Ignore cleanup errors
    }

    // Create test input file
    fs.writeFileSync(testInputPath, JSON.stringify(testData, null, 2));

    // Initialize builder
    builder = new AntipatternBuilder({
      outputDir: testOutputDir,
      primaryKeyField: 'id',
      batchSize: 1, // Individual files
      indexFields: ['id', 'status', 'age', 'roles', 'preferences.theme'],
      verbose: false,
    });
  });

  after(() => {
    // Cleanup test files
    try {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
      fs.rmSync(testBatchDir, { recursive: true, force: true });
      if (fs.existsSync(testInputPath)) {
        fs.unlinkSync(testInputPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should build database successfully', async () => {
    const buildResult = await builder.build(testInputPath);

    assert.strictEqual(buildResult.totalRecords, 3, 'Should process 3 records');
    assert.strictEqual(buildResult.totalFiles, 3, 'Should create 3 data files');
    assert.strictEqual(buildResult.schemaGenerated, true, 'Should generate schemas');
    assert(buildResult.buildTime > 0, 'Should have valid build time');
  });

  test('should create correct file structure', () => {
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
  });

  test('should create correct data files', () => {
    const dataDir = path.join(testOutputDir, 'data');
    const dataFiles = fs
      .readdirSync(dataDir, { recursive: true })
      .filter(f => typeof f === 'string' && f.endsWith('.json'));
    assert.strictEqual(dataFiles.length, 3, 'Should have 3 data files');

    // Read a data file and validate structure
    const firstDataFile = path.join(dataDir, dataFiles[0] as string);
    const recordData = JSON.parse(fs.readFileSync(firstDataFile, 'utf8'));
    assert(recordData.id, 'Record should have id field');
    assert(recordData.name, 'Record should have name field');
    assert(recordData.profile, 'Record should have nested profile field');
  });

  test('should create correct indexes', () => {
    const indexesDir = path.join(testOutputDir, 'indexes');
    const indexFiles = fs.readdirSync(indexesDir).filter(f => f.endsWith('.json'));

    // Should have at least: _primary.json, id.json, status.json, age.json, preferences_theme.json, roles.json
    assert(indexFiles.length >= 5, `Should have at least 5 index files, got ${indexFiles.length}`);
    assert(indexFiles.includes('_primary.json'), 'Should have primary index');
    assert(indexFiles.includes('id.json'), 'Should have id index');
    assert(indexFiles.includes('status.json'), 'Should have status index');

    // Validate index file structure
    const statusIndex = JSON.parse(fs.readFileSync(path.join(indexesDir, 'status.json'), 'utf8'));
    assert.strictEqual(statusIndex.field, 'status', 'Index should have correct field name');
    assert(Array.isArray(statusIndex.entries), 'Index should have entries array');
    assert.strictEqual(
      statusIndex.entries.length,
      2,
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
  });

  test('should handle array field indexing correctly', () => {
    const indexesDir = path.join(testOutputDir, 'indexes');
    const indexFiles = fs.readdirSync(indexesDir).filter(f => f.endsWith('.json'));

    if (indexFiles.includes('roles.json')) {
      const rolesIndex = JSON.parse(fs.readFileSync(path.join(indexesDir, 'roles.json'), 'utf8'));
      assert.strictEqual(rolesIndex.field, 'roles', 'Roles index should have correct field name');

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
  });

  test('should handle nested field indexing correctly', () => {
    const indexesDir = path.join(testOutputDir, 'indexes');
    const indexFiles = fs.readdirSync(indexesDir).filter(f => f.endsWith('.json'));

    if (indexFiles.includes('preferences_theme.json')) {
      const themeIndex = JSON.parse(
        fs.readFileSync(path.join(indexesDir, 'preferences_theme.json'), 'utf8')
      );
      assert.strictEqual(
        themeIndex.field,
        'preferences.theme',
        'Theme index should have correct field name'
      );

      // Should have entries for 'dark', 'light', 'auto'
      const darkEntry = themeIndex.entries.find((e: any) => e.value === 'dark');
      const lightEntry = themeIndex.entries.find((e: any) => e.value === 'light');
      const autoEntry = themeIndex.entries.find((e: any) => e.value === 'auto');

      assert(darkEntry && darkEntry.recordIds.length === 1, 'Dark theme should have 1 record');
      assert(lightEntry && lightEntry.recordIds.length === 1, 'Light theme should have 1 record');
      assert(autoEntry && autoEntry.recordIds.length === 1, 'Auto theme should have 1 record');
    }
  });

  test('should validate metadata correctly', () => {
    const metadata = JSON.parse(fs.readFileSync(path.join(testOutputDir, 'metadata.json'), 'utf8'));
    const splitMetadata = JSON.parse(
      fs.readFileSync(path.join(testOutputDir, 'split-metadata.json'), 'utf8')
    );

    assert.strictEqual(metadata.totalRecords, 3, 'Metadata should show 3 records');
    assert.strictEqual(splitMetadata.totalRecords, 3, 'Split metadata should show 3 records');
    assert.strictEqual(splitMetadata.totalFiles, 3, 'Split metadata should show 3 files');
    assert(Array.isArray(metadata.indexes), 'Metadata should have indexes array');
    assert(metadata.indexes.length > 0, 'Should have generated indexes');
  });

  test('should validate database successfully', async () => {
    const isValid = await builder.validate();
    assert.strictEqual(isValid, true, 'Database should validate successfully');
  });

  test('should provide database info correctly', async () => {
    const info = await builder.info();
    assert.strictEqual(info.database.totalRecords, 3, 'Info should show 3 records');
    assert.strictEqual(info.data.totalFiles, 3, 'Info should show 3 files');
    assert(info.build, 'Info should include build manifest');
    assert(Array.isArray(info.indexes), 'Info should include indexes');
  });

  test('should support batch mode', async () => {
    // Test batch mode with batchSize = 2
    const batchBuilder = new AntipatternBuilder({
      outputDir: testBatchDir,
      primaryKeyField: 'id',
      batchSize: 2, // 2 records per file
      useSubdirectories: false, // Disable subdirectories for simpler testing
      verbose: false,
    });

    const buildResult = await batchBuilder.build(testInputPath);
    assert.strictEqual(buildResult.totalRecords, 3, 'Should process 3 records');
    assert.strictEqual(buildResult.totalFiles, 2, 'Should create 2 batch files (2+1)');

    const dataDir = path.join(testBatchDir, 'data');
    const batchFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    assert.strictEqual(batchFiles.length, 2, 'Should have 2 batch files');

    // Verify first batch has 2 records, second has 1
    // Files are named batch_0000.json, batch_0001.json, etc.
    const batch1 = JSON.parse(fs.readFileSync(path.join(dataDir, 'batch_0000.json'), 'utf8'));
    const batch2 = JSON.parse(fs.readFileSync(path.join(dataDir, 'batch_0001.json'), 'utf8'));

    assert.strictEqual(batch1.length, 2, 'First batch should have 2 records');
    assert.strictEqual(batch2.length, 1, 'Second batch should have 1 record');
  });
});

describe('DataSplitter Validation Tests', () => {
  const testOutputDir = './test-data-splitter-output';

  before(() => {
    // Cleanup any existing test files
    try {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  after(() => {
    // Cleanup test files
    try {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should successfully split valid records with unique primary keys', () => {
    const splitter = new DataSplitter({
      outputDir: testOutputDir,
      primaryKeyField: 'id',
      batchSize: 1,
    });

    const validRecords = [
      { id: 'user-1', name: 'John' },
      { id: 'user-2', name: 'Jane' },
      { id: 'user-3', name: 'Bob' },
    ];

    const result = splitter.splitRecords(validRecords);
    assert.strictEqual(result.totalRecords, 3, 'Should process all 3 records');
    assert.strictEqual(result.totalFiles, 3, 'Should create 3 files');
  });

  test('should throw error for empty records array', () => {
    const splitter = new DataSplitter({
      outputDir: testOutputDir,
      primaryKeyField: 'id',
    });

    assert.throws(
      () => splitter.splitRecords([]),
      { message: 'No records to split.' },
      'Should throw error for empty records array'
    );
  });

  test('should throw error when primary key field is missing', () => {
    const splitter = new DataSplitter({
      outputDir: testOutputDir,
      primaryKeyField: 'id',
    });

    const recordsWithMissingPrimaryKey = [
      { id: 'user-1', name: 'John' },
      { name: 'Jane' }, // Missing 'id' field
      { id: 'user-3', name: 'Bob' },
    ];

    assert.throws(
      () => splitter.splitRecords(recordsWithMissingPrimaryKey),
      { message: 'All records must have a "id" field.' },
      'Should throw error when records are missing primary key field'
    );
  });

  test('should throw error for duplicate primary key values', () => {
    const splitter = new DataSplitter({
      outputDir: testOutputDir,
      primaryKeyField: 'id',
    });

    const recordsWithDuplicates = [
      { id: 'user-1', name: 'John' },
      { id: 'user-2', name: 'Jane' },
      { id: 'user-1', name: 'Bob' }, // Duplicate 'user-1' id
    ];

    assert.throws(
      () => splitter.splitRecords(recordsWithDuplicates),
      { message: 'Duplicate primary key value found: user-1' },
      'Should throw error for duplicate primary key values'
    );
  });

  test('should throw error for null primary key values', () => {
    const splitter = new DataSplitter({
      outputDir: testOutputDir,
      primaryKeyField: 'id',
    });

    const recordsWithNullPrimaryKey = [
      { id: 'user-1', name: 'John' },
      { id: null, name: 'Jane' },
      { id: null, name: 'Bob' }, // Another null - this should trigger duplicate error
    ];

    assert.throws(
      () => splitter.splitRecords(recordsWithNullPrimaryKey),
      { message: 'Duplicate primary key value found: null' },
      'Should throw error when multiple records have null primary key'
    );
  });

  test('should throw error for undefined primary key values', () => {
    const splitter = new DataSplitter({
      outputDir: testOutputDir,
      primaryKeyField: 'id',
    });

    const recordsWithUndefinedPrimaryKey = [
      { id: 'user-1', name: 'John' },
      { id: undefined, name: 'Jane' },
      { id: undefined, name: 'Bob' }, // Another undefined - this should trigger duplicate error
    ];

    assert.throws(
      () => splitter.splitRecords(recordsWithUndefinedPrimaryKey),
      { message: 'Duplicate primary key value found: undefined' },
      'Should throw error when multiple records have undefined primary key'
    );
  });

  test('should work with custom primary key field', () => {
    const splitter = new DataSplitter({
      outputDir: testOutputDir,
      primaryKeyField: 'userId',
      batchSize: 1,
    });

    const recordsWithCustomPrimaryKey = [
      { userId: 'abc123', name: 'John' },
      { userId: 'def456', name: 'Jane' },
      { userId: 'ghi789', name: 'Bob' },
    ];

    const result = splitter.splitRecords(recordsWithCustomPrimaryKey);
    assert.strictEqual(result.totalRecords, 3, 'Should process all 3 records');
    assert.strictEqual(result.totalFiles, 3, 'Should create 3 files');
  });

  test('should throw error when custom primary key field is missing', () => {
    const splitter = new DataSplitter({
      outputDir: testOutputDir,
      primaryKeyField: 'userId',
    });

    const recordsWithMissingCustomPrimaryKey = [
      { userId: 'abc123', name: 'John' },
      { id: 'user-2', name: 'Jane' }, // Has 'id' but not 'userId'
      { userId: 'ghi789', name: 'Bob' },
    ];

    assert.throws(
      () => splitter.splitRecords(recordsWithMissingCustomPrimaryKey),
      { message: 'All records must have a "userId" field.' },
      'Should throw error when records are missing custom primary key field'
    );
  });

  test('should work correctly in batch mode with validation', () => {
    const splitter = new DataSplitter({
      outputDir: testOutputDir,
      primaryKeyField: 'id',
      batchSize: 2, // 2 records per batch
    });

    const validRecords = [
      { id: 'user-1', name: 'John' },
      { id: 'user-2', name: 'Jane' },
      { id: 'user-3', name: 'Bob' },
      { id: 'user-4', name: 'Alice' },
    ];

    const result = splitter.splitRecords(validRecords);
    assert.strictEqual(result.totalRecords, 4, 'Should process all 4 records');
    assert.strictEqual(result.totalFiles, 2, 'Should create 2 batch files');
  });

  test('should throw error in batch mode when primary key field is missing', () => {
    const splitter = new DataSplitter({
      outputDir: testOutputDir,
      primaryKeyField: 'id',
      batchSize: 2,
    });

    const recordsWithMissingPrimaryKey = [
      { id: 'user-1', name: 'John' },
      { name: 'Jane' }, // Missing 'id' field
      { id: 'user-3', name: 'Bob' },
    ];

    assert.throws(
      () => splitter.splitRecords(recordsWithMissingPrimaryKey),
      { message: 'All records must have a "id" field.' },
      'Should throw error in batch mode when records are missing primary key field'
    );
  });

  test('should allow single null/undefined primary key if only one exists', () => {
    const splitter = new DataSplitter({
      outputDir: testOutputDir,
      primaryKeyField: 'id',
      batchSize: 1,
    });

    // Single null value should be allowed (not duplicate)
    const recordsWithSingleNull = [
      { id: 'user-1', name: 'John' },
      { id: null, name: 'Jane' },
      { id: 'user-3', name: 'Bob' },
    ];

    // This should NOT throw an error since there's only one null value
    const result = splitter.splitRecords(recordsWithSingleNull);
    assert.strictEqual(result.totalRecords, 3, 'Should process all 3 records');
    assert.strictEqual(result.totalFiles, 3, 'Should create 3 files');
  });

  test('should handle numeric primary keys correctly', () => {
    const splitter = new DataSplitter({
      outputDir: testOutputDir,
      primaryKeyField: 'id',
      batchSize: 1,
    });

    const recordsWithNumericKeys = [
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' },
      { id: 3, name: 'Bob' },
    ];

    const result = splitter.splitRecords(recordsWithNumericKeys);
    assert.strictEqual(result.totalRecords, 3, 'Should process all 3 records');
    assert.strictEqual(result.totalFiles, 3, 'Should create 3 files');
  });

  test('should throw error for duplicate numeric primary keys', () => {
    const splitter = new DataSplitter({
      outputDir: testOutputDir,
      primaryKeyField: 'id',
    });

    const recordsWithDuplicateNumericKeys = [
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' },
      { id: 1, name: 'Bob' }, // Duplicate numeric id
    ];

    assert.throws(
      () => splitter.splitRecords(recordsWithDuplicateNumericKeys),
      { message: 'Duplicate primary key value found: 1' },
      'Should throw error for duplicate numeric primary key values'
    );
  });
});
