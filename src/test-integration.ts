import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { AntipatternBuilder } from './builder/index.js';
import { AntipatternDB } from './runtime/query-client.js';

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

async function runIntegrationTest() {
  console.log('🧪 Running complete integration test...\n');

  const testInputPath = './test-integration-input.json';
  const testOutputDir = './test-integration-db';

  // Cleanup any existing test files
  try {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
    if (fs.existsSync(testInputPath)) {
      fs.unlinkSync(testInputPath);
    }
  } catch {
    // Ignore cleanup errors
  }

  try {
    // Step 1: Create test input file
    console.log('📄 Step 1: Creating test data...');
    fs.writeFileSync(testInputPath, JSON.stringify(testData, null, 2));
    console.log(`   Created ${testInputPath} with ${testData.length} records`);

    // Step 2: Build database using AntipatternBuilder
    console.log('\n🏗️  Step 2: Building database...');
    const builder = new AntipatternBuilder({
      outputDir: testOutputDir,
      primaryKeyField: 'id',
      batchSize: 2, // Test batch mode
      indexFields: ['id', 'status', 'age', 'roles', 'tags', 'profile.preferences.theme'],
      verbose: false, // Keep output clean for test
    });

    const buildResult = await builder.build(testInputPath);
    console.log(`   ✅ Database built successfully!`);
    console.log(`   📊 Records: ${buildResult.totalRecords}`);
    console.log(`   📄 Files: ${buildResult.totalFiles}`);
    console.log(`   📇 Indexes: ${buildResult.totalIndexes}`);
    console.log(`   ⏱️  Build time: ${buildResult.buildTime}ms`);

    // Validate build results
    assert(buildResult.totalRecords === 5, 'Should have 5 records');
    assert(buildResult.totalFiles === 3, 'Should have 3 batch files (2+2+1)');
    assert(buildResult.schemaGenerated === true, 'Should generate schemas');

    // Step 3: Initialize query client
    console.log('\n🔍 Step 3: Initializing query client...');
    const db = new AntipatternDB(testOutputDir);
    await db.init();
    console.log('   ✅ Database client initialized');

    // Validate metadata loading
    const stats = await db.getStats();
    assert(stats?.totalRecords === 5, 'Metadata should show 5 records');
    console.log(
      `   📊 Loaded metadata: ${stats?.totalRecords} records, ${stats?.indexes.length} indexes`
    );

    // Step 4: Test individual record retrieval
    console.log('\n🎯 Step 4: Testing individual record retrieval...');

    const user1 = await db.get('user-1');
    assert(user1 !== null, 'Should find user-1');
    assert(user1.name === 'Alice Johnson', 'Should have correct name');
    assert(user1.age === 28, 'Should have correct age');
    console.log(`   ✅ Retrieved user: ${user1.name} (${user1.status})`);

    const nonExistent = await db.get('user-999');
    assert(nonExistent === null, 'Should return null for non-existent record');
    console.log('   ✅ Correctly returned null for non-existent record');

    // Step 5: Test basic filtering
    console.log('\n🔍 Step 5: Testing basic filtering...');

    const activeUsers = await db.query().where('status', 'active').exec();

    assert(activeUsers.records.length === 3, 'Should find 3 active users');
    assert(activeUsers.totalCount === 3, 'Total count should be 3');
    console.log(`   ✅ Found ${activeUsers.records.length} active users`);

    // Test with operator
    const olderUsers = await db.query().where('age', '>', 30).exec();

    assert(
      olderUsers.records.length === 3,
      'Should find 3 users over 30 (Bob 35, Charlie 42, Diana 31)'
    );
    console.log(`   ✅ Found ${olderUsers.records.length} users over 30`);

    // Step 6: Test array field filtering
    console.log('\n🔍 Step 6: Testing array field filtering...');

    const admins = await db.query().where('roles', 'contains', 'admin').exec();

    assert(admins.records.length === 2, 'Should find 2 admin users');
    console.log(`   ✅ Found ${admins.records.length} admin users`);

    const developers = await db.query().where('tags', 'contains', 'typescript').exec();

    assert(developers.records.length === 1, 'Should find 1 typescript developer');
    console.log(`   ✅ Found ${developers.records.length} typescript developers`);

    // Step 7: Test nested field filtering
    console.log('\n🔍 Step 7: Testing nested field filtering...');

    const darkThemeUsers = await db.query().where('profile.preferences.theme', 'dark').exec();

    assert(darkThemeUsers.records.length === 2, 'Should find 2 dark theme users');
    console.log(`   ✅ Found ${darkThemeUsers.records.length} dark theme users`);

    // Step 8: Test complex queries with multiple filters
    console.log('\n🔍 Step 8: Testing complex queries...');

    const complexQuery = await db
      .query()
      .where('status', 'active')
      .where('age', '>=', 30)
      .where('roles', 'contains', 'admin')
      .exec();

    assert(complexQuery.records.length === 1, 'Should find 1 active admin user over 30');
    assert(complexQuery.records[0].name === 'Diana Prince', 'Should be Diana Prince');
    console.log(`   ✅ Complex query found: ${complexQuery.records[0].name}`);

    // Step 9: Test sorting
    console.log('\n🔍 Step 9: Testing sorting...');

    const sortedByAge = await db.query().where('status', 'active').sort('age', 'desc').exec();

    assert(sortedByAge.records.length === 3, 'Should have 3 active users');
    assert(sortedByAge.records[0].age === 35, 'First should be oldest');
    assert(sortedByAge.records[2].age === 28, 'Last should be youngest');
    console.log(`   ✅ Sorted by age: ${sortedByAge.records.map(u => u.age).join(', ')}`);

    // Step 10: Test pagination
    console.log('\n🔍 Step 10: Testing pagination...');

    const page1 = await db.query().sort('name').limit(2).exec();

    assert(page1.records.length === 2, 'First page should have 2 records');
    assert(page1.hasMore === true, 'Should indicate more records available');
    console.log(`   ✅ Page 1: ${page1.records.map(u => u.name).join(', ')}`);

    const page2 = await db.query().sort('name').limit(2).offset(2).exec();

    assert(page2.records.length === 2, 'Second page should have 2 records');
    console.log(`   ✅ Page 2: ${page2.records.map(u => u.name).join(', ')}`);

    // Step 11: Test performance and caching
    console.log('\n⚡ Step 11: Testing performance...');

    const start = Date.now();
    const perfResults = await Promise.all([
      db.get('user-1'), // Should use cache
      db.query().where('status', 'active').exec(), // Should use index
      db.get('user-2'), // Should use cache
    ]);
    const elapsed = Date.now() - start;

    assert(perfResults[0]?.name === 'Alice Johnson', 'Cached retrieval should work');
    assert(perfResults[1].records.length === 3, 'Indexed query should work');
    console.log(`   ✅ 3 operations completed in ${elapsed}ms (caching working)`);

    // Step 12: Test utility methods
    console.log('\n🔧 Step 12: Testing utility methods...');

    const totalCount = await db.count();
    assert(totalCount === 5, 'Count should return 5');

    const fields = await db.getFields();
    assert(fields.includes('name'), 'Fields should include name');
    assert(fields.includes('status'), 'Fields should include status');

    const indexedFields = await db.getIndexedFields();
    assert(indexedFields.includes('status'), 'Indexed fields should include status');
    assert(indexedFields.includes('age'), 'Indexed fields should include age');

    console.log(
      `   ✅ Count: ${totalCount}, Fields: ${fields.length}, Indexed: ${indexedFields.length}`
    );

    // Step 13: Validate database consistency
    console.log('\n✅ Step 13: Validating database consistency...');

    const isValid = await builder.validate();
    assert(isValid === true, 'Database validation should pass');

    const info = await builder.info();
    assert(info.database.totalRecords === 5, 'Info should show correct record count');
    console.log('   ✅ Database validation passed');

    console.log('\n🎉 Integration test completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('✓ Database building from JSON input');
    console.log('✓ Schema generation and type introspection');
    console.log('✓ Data splitting into batch files');
    console.log('✓ Index generation for efficient querying');
    console.log('✓ Runtime query client initialization');
    console.log('✓ Individual record retrieval with caching');
    console.log('✓ Basic filtering with various operators');
    console.log('✓ Array field filtering (contains)');
    console.log('✓ Nested object field querying');
    console.log('✓ Complex multi-filter queries');
    console.log('✓ Sorting and ordering');
    console.log('✓ Pagination with limit/offset');
    console.log('✓ Performance and caching optimization');
    console.log('✓ Database validation and consistency');
    console.log('✓ Utility methods and metadata access');

    console.log('\n🚀 Usage Example:');
    console.log(`   # Build database from JSON`);
    console.log(`   pnpm run db:build ${testInputPath} -o ${testOutputDir}`);
    console.log(`   `);
    console.log(`   # Query in your application`);
    console.log(`   import { AntipatternDB } from 'antipattern-db';`);
    console.log(`   const db = new AntipatternDB('${testOutputDir}');`);
    console.log(`   await db.init();`);
    console.log(`   const users = await db.query()`);
    console.log(`     .where('status', 'active')`);
    console.log(`     .where('age', '>', 25)`);
    console.log(`     .sort('name')`);
    console.log(`     .limit(10)`);
    console.log(`     .exec();`);
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    throw error;
  } finally {
    // Cleanup
    try {
      if (fs.existsSync(testInputPath)) {
        fs.unlinkSync(testInputPath);
      }
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTest().catch(error => {
    console.error('Integration test failed:', error);
    process.exit(1);
  });
}

export { runIntegrationTest };
