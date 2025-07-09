import { test, describe, before, after } from 'node:test';
import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { AntipatternBuilder } from '../src/builder/index.js';
import { AntipatternDB } from '../src/runtime/query-client.js';

// Test data with complex structure to test all features
const testData = [
  {
    id: 'user-1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    age: 28,
    status: 'active',
    roles: ['user', 'admin'],
    joinedAt: '2023-01-15T10:00:00Z',
    profile: {
      bio: 'Software Engineer',
      website: 'https://alice.dev',
      preferences: {
        theme: 'dark',
        notifications: true,
      },
    },
    tags: ['developer', 'typescript', 'react'],
  },
  {
    id: 'user-2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    age: 35,
    status: 'active',
    roles: ['user', 'moderator'],
    joinedAt: '2023-02-20T14:30:00Z',
    profile: {
      bio: 'Product Manager',
      website: 'https://bobsmith.com',
      preferences: {
        theme: 'light',
        notifications: false,
      },
    },
    tags: ['product', 'strategy'],
  },
  {
    id: 'user-3',
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    age: 42,
    status: 'inactive',
    roles: ['user'],
    joinedAt: '2022-12-01T09:15:00Z',
    profile: {
      bio: 'Designer',
      website: null,
      preferences: {
        theme: 'auto',
        notifications: true,
      },
    },
    tags: ['design', 'ui', 'ux'],
  },
  {
    id: 'user-4',
    name: 'Diana Prince',
    email: 'diana@example.com',
    age: 31,
    status: 'active',
    roles: ['user', 'admin', 'moderator'],
    joinedAt: '2023-03-10T16:45:00Z',
    profile: {
      bio: 'DevOps Engineer',
      website: 'https://diana.cloud',
      preferences: {
        theme: 'dark',
        notifications: true,
      },
    },
    tags: ['devops', 'kubernetes', 'aws'],
  },
  {
    id: 'user-5',
    name: 'Eve Wilson',
    email: 'eve@example.com',
    age: 26,
    status: 'pending',
    roles: ['user'],
    joinedAt: '2023-06-01T11:20:00Z',
    profile: {
      bio: 'Data Scientist',
      website: 'https://eve-analytics.com',
      preferences: {
        theme: 'light',
        notifications: false,
      },
    },
    tags: ['data', 'python', 'ml'],
  },
];

describe('Integration Tests', () => {
  const testInputPath = './test-integration-input.json';
  const testOutputDir = './test-integration-db';
  let db: AntipatternDB;

  before(async () => {
    // Cleanup any existing test files
    try {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
      if (fs.existsSync(testInputPath)) {
        fs.unlinkSync(testInputPath);
      }
    } catch {
      // Ignore cleanup errors
    }

    // Create test input file
    fs.writeFileSync(testInputPath, JSON.stringify(testData, null, 2));

    // Build database
    const builder = new AntipatternBuilder({
      outputDir: testOutputDir,
      primaryKeyField: 'id',
      batchSize: 2, // Test batch mode
      indexFields: ['id', 'status', 'age', 'roles', 'tags', 'profile.preferences.theme'],
      verbose: false, // Keep output clean for test
    });

    await builder.build(testInputPath);

    // Initialize query client
    db = new AntipatternDB(testOutputDir);
    await db.init();
  });

  after(() => {
    // Cleanup test files
    try {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
      if (fs.existsSync(testInputPath)) {
        fs.unlinkSync(testInputPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should build database with correct record count', async () => {
    const stats = await db.getStats();
    assert.strictEqual(stats?.totalRecords, 5, 'Should have 5 records');
    assert(stats?.indexes.length > 0, 'Should have indexes');
  });

  test('should retrieve individual records', async () => {
    const user1 = await db.get('user-1');
    assert(user1 !== null, 'Should find user-1');
    assert.strictEqual(user1.name, 'Alice Johnson', 'Should have correct name');
    assert.strictEqual(user1.age, 28, 'Should have correct age');

    const nonExistent = await db.get('user-999');
    assert.strictEqual(nonExistent, null, 'Should return null for non-existent record');
  });

  test('should filter by status', async () => {
    const activeUsers = await db.query().where('status').equals('active').exec();
    assert.strictEqual(activeUsers.records.length, 3, 'Should find 3 active users');
    assert.strictEqual(activeUsers.totalCount, 3, 'Total count should be 3');
  });

  test('should filter by age range', async () => {
    const olderUsers = await db.query().where('age').greaterThan(30).exec();
    assert.strictEqual(olderUsers.records.length, 3, 'Should find 3 users over 30');
  });

  test('should filter array fields', async () => {
    const admins = await db.query().where('roles').contains('admin').exec();
    assert.strictEqual(admins.records.length, 2, 'Should find 2 admin users');

    const developers = await db.query().where('tags').contains('typescript').exec();
    assert.strictEqual(developers.records.length, 1, 'Should find 1 typescript developer');
  });

  test('should filter nested fields', async () => {
    const darkThemeUsers = await db
      .query()
      .where('profile.preferences.theme')
      .equals('dark')
      .exec();
    assert.strictEqual(darkThemeUsers.records.length, 2, 'Should find 2 dark theme users');
  });

  test('should handle multiple filters', async () => {
    const result = await db
      .query()
      .where('status')
      .equals('active')
      .where('age')
      .greaterThan(25)
      .exec();
    assert.strictEqual(result.records.length, 3, 'Should find 3 active users over 25');
  });

  test('should support ordering', async () => {
    const orderedByAge = await db.query().sort('age', 'asc').exec();
    assert.strictEqual(orderedByAge.records.length, 5, 'Should return all 5 records');
    assert.strictEqual(
      orderedByAge.records[0].age,
      26,
      'First record should be youngest (Eve, 26)'
    );
    assert.strictEqual(
      orderedByAge.records[4].age,
      42,
      'Last record should be oldest (Charlie, 42)'
    );
  });

  test('should support pagination', async () => {
    const page1 = await db.query().limit(2).offset(0).exec();
    assert.strictEqual(page1.records.length, 2, 'First page should have 2 records');

    const page2 = await db.query().limit(2).offset(2).exec();
    assert.strictEqual(page2.records.length, 2, 'Second page should have 2 records');

    const page3 = await db.query().limit(2).offset(4).exec();
    assert.strictEqual(page3.records.length, 1, 'Third page should have 1 record');
  });

  test('should count records without fetching', async () => {
    const result = await db.query().where('status').equals('active').exec();
    assert.strictEqual(result.totalCount, 3, 'Should count 3 active users');
  });

  test('should handle complex queries', async () => {
    const result = await db
      .query()
      .where('status')
      .equals('active')
      .where('roles')
      .contains('admin')
      .where('age')
      .greaterThan(25)
      .sort('age', 'desc')
      .limit(1)
      .exec();

    assert.strictEqual(result.records.length, 1, 'Should find 1 matching record');
    assert.strictEqual(
      result.records[0].name,
      'Diana Prince',
      'Should be Diana (31, admin, active)'
    );
  });
});
