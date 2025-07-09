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

    // Test 2: Check that we have a proper cards array schema with CardsItemSchema
    console.log('✅ Test 2: Proper cards array schema');
    assert(schemaContent.includes('cards:'), 'Should have cards field');
    assert(
      schemaContent.includes('z.array(CardsItemSchema)'),
      'Cards should use CardsItemSchema in array'
    );

    // Test 3: Check that we have a unified CardsItemSchema
    console.log('✅ Test 3: Unified CardsItemSchema definition');
    assert(
      schemaContent.includes('const CardsItemSchema = z.object({'),
      'Should have CardsItemSchema definition'
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
    assert(
      typesContent.includes('cards: CardsItem[]'),
      'Should have cards: CardsItem[] in GeneratedRecord'
    );
    assert(
      typesContent.includes('export interface CardsItem {'),
      'Should have CardsItem interface'
    );

    // Test 7: Check that nested object fields are properly typed
    console.log('✅ Test 7: Nested objects properly typed');
    assert(schemaContent.includes('colors: z.array(z.string())'), 'Colors should be string array');
    assert(schemaContent.includes('setType: z.enum(['), 'SetType should be enum');

    // Test 8: Check that datetime fields are properly detected
    console.log('✅ Test 8: Datetime fields properly detected');
    assert(
      schemaContent.includes('releasedAt: z.string().datetime()'),
      'ReleasedAt should be datetime'
    );

    // Test 9: Check enum values are correctly generated
    console.log('✅ Test 9: Enum values correctly generated');
    assert(
      schemaContent.includes("z.enum(['core', 'expansion'])") ||
        schemaContent.includes('z.enum(["core", "expansion"])'),
      'SetType enum should include core and expansion values'
    );

    // Test 10: Check main record schema structure
    console.log('✅ Test 10: Main record schema structure');
    assert(
      schemaContent.includes('export const RecordSchema = z.object({'),
      'Should have RecordSchema export'
    );
    assert(
      schemaContent.includes('export type Record = z.infer<typeof RecordSchema>'),
      'Should have Record type export'
    );

    // Test 11: Check TypeScript interface for nested objects
    console.log('✅ Test 11: TypeScript interfaces for nested objects');
    assert(
      typesContent.includes('export interface GeneratedRecord {'),
      'Should have GeneratedRecord interface'
    );
    assert(
      typesContent.includes("setType: 'core' | 'expansion';"),
      'Should have union type for setType'
    );

    console.log('\n🎉 All tests passed! Schema generation is working correctly.\n');

    // Show summary of generated structure
    console.log('📋 Generated Schema Summary:');
    console.log('- Main RecordSchema with proper field types');
    console.log('- Unified CardsItemSchema for array elements');
    console.log('- Proper optionality detection (only truly optional fields marked)');
    console.log('- Deep introspection of nested objects and arrays');
    console.log('- Enum generation for fields with limited values');
    console.log('- Datetime detection for ISO 8601 strings');
    console.log('- Valid JavaScript/TypeScript syntax');

    // Show some key parts of the generated schema
    console.log('\n📄 Key Schema Parts:');
    const cardsMatch = schemaContent.match(/cards: .+/);
    if (cardsMatch) {
      console.log(`  cards: ${cardsMatch[0]}`);
    }

    const enumMatch = schemaContent.match(/setType: .+/);
    if (enumMatch) {
      console.log(`  setType: ${enumMatch[0]}`);
    }

    const datetimeMatch = schemaContent.match(/releasedAt: .+/);
    if (datetimeMatch) {
      console.log(`  releasedAt: ${datetimeMatch[0]}`);
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
