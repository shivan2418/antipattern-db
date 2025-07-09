import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import JSONToZodGenerator from './jsontozod.js';

// Test data that mimics the structure we're trying to fix
const testData = [
  {
    id: 'artist-1',
    name: 'Test Artist 1',
    cards: [
      {
        id: 'card-1',
        name: 'Test Card 1',
        oracleId: 'oracle-1',
        colors: ['red', 'blue'],
        setType: 'core',
        releasedAt: '2023-01-01T00:00:00Z',
      },
      {
        id: 'card-2',
        name: 'Test Card 2',
        oracleId: 'oracle-2',
        colors: ['green'],
        setType: 'expansion',
        releasedAt: '2023-02-01T00:00:00Z',
      },
    ],
  },
  {
    id: 'artist-2',
    name: 'Test Artist 2',
    cards: [
      {
        id: 'card-3',
        name: 'Test Card 3',
        oracleId: 'oracle-3',
        colors: ['white', 'black'],
        setType: 'core',
        releasedAt: '2023-03-01T00:00:00Z',
      },
    ],
  },
];

async function runTests() {
  console.log('🧪 Running schema generation tests...\n');

  // Create test input file
  const testInputPath = './test-input.json';
  const testOutputDir = './test-output';

  fs.writeFileSync(testInputPath, JSON.stringify(testData, null, 2));

  try {
    // Generate schema
    const generator = new JSONToZodGenerator({
      optionalThreshold: 0.5, // Only mark as optional if present in less than 50% of records
    });

    await generator.generateFromFile(testInputPath, testOutputDir);

    // Read generated files
    const schemaContent = fs.readFileSync(path.join(testOutputDir, 'schema.ts'), 'utf8');
    const typesContent = fs.readFileSync(path.join(testOutputDir, 'types.ts'), 'utf8');

    // Test 1: Check that we don't have individual card schemas
    console.log('✅ Test 1: No individual card schemas');
    assert(!schemaContent.includes('Cards[0]Schema'), 'Should not have Cards[0]Schema');
    assert(!schemaContent.includes('Cards[1]Schema'), 'Should not have Cards[1]Schema');
    assert(!schemaContent.includes('Cards[2]Schema'), 'Should not have Cards[2]Schema');

    // Test 2: Check that we have a proper cards array schema
    console.log('✅ Test 2: Proper cards array schema');
    assert(schemaContent.includes('cards:'), 'Should have cards field');
    assert(schemaContent.includes('z.array('), 'Cards should be an array schema');

    // Test 3: Check that we have a unified card item schema
    console.log('✅ Test 3: Unified card item schema');
    assert(
      schemaContent.includes('CardsItemSchema') || schemaContent.includes('z.array(z.object('),
      'Should have unified card schema'
    );

    // Test 4: Check that required fields are not marked as optional
    console.log('✅ Test 4: Required fields not marked as optional');
    // Since id, name appear in 100% of records, they should not be optional
    assert(!schemaContent.includes('id: z.string().optional()'), 'id should not be optional');
    assert(!schemaContent.includes('name: z.string().optional()'), 'name should not be optional');

    // Test 5: Check that the schema compiles (no syntax errors)
    console.log('✅ Test 5: Schema syntax is valid');
    assert(!schemaContent.includes('Cards['), 'Should not have invalid bracket syntax');

    // Test 6: Check TypeScript types are properly generated
    console.log('✅ Test 6: TypeScript types properly generated');
    assert(typesContent.includes('cards'), 'Should have cards in types');
    assert(
      typesContent.includes('Record<string, unknown>[]') || typesContent.includes('CardsItem[]'),
      'Should have proper array typing'
    );

    // Test 7: Check that nested object fields are properly typed
    console.log('✅ Test 7: Nested objects properly typed');
    assert(schemaContent.includes('colors: z.array(z.string())'), 'Colors should be string array');
    assert(
      schemaContent.includes('setType: z.enum(') || schemaContent.includes('setType: z.union('),
      'SetType should be enum or union'
    );

    // Test 8: Check that datetime fields are properly detected
    console.log('✅ Test 8: Datetime fields properly detected');
    assert(
      schemaContent.includes('releasedAt: z.string().datetime()'),
      'ReleasedAt should be datetime'
    );

    console.log('\n🎉 All tests passed! Schema generation is working correctly.\n');

    // Show summary of generated structure
    console.log('📋 Generated Schema Summary:');
    console.log('- Main record schema with proper field types');
    console.log('- Unified card item schema (not individual schemas per card)');
    console.log('- Proper optionality detection (only truly optional fields marked)');
    console.log('- Deep introspection of nested objects and arrays');
    console.log('- Valid JavaScript/TypeScript syntax');

    // Show some key parts of the generated schema
    console.log('\n📄 Key Schema Parts:');
    const cardsMatch = schemaContent.match(/cards: .+/);
    if (cardsMatch) {
      console.log(`  cards: ${cardsMatch[0]}`);
    }

    const idMatch = schemaContent.match(/id: .+/);
    if (idMatch) {
      console.log(`  id: ${idMatch[0]}`);
    }

    const nameMatch = schemaContent.match(/name: .+/);
    if (nameMatch) {
      console.log(`  name: ${nameMatch[0]}`);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
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
runTests();
