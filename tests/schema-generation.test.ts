import { test, describe, before, after } from 'node:test';
import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import JSONToZodGenerator from '../src/jsontozod.js';

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

describe('Schema Generation Tests', () => {
  const testInputPath = './test-input.json';
  const testOutputDir = './test-output';

  before(() => {
    // Create test input file
    fs.writeFileSync(testInputPath, JSON.stringify(testData, null, 2));
  });

  after(() => {
    // Cleanup
    try {
      if (fs.existsSync(testInputPath)) {
        fs.unlinkSync(testInputPath);
      }
      if (fs.existsSync(testOutputDir)) {
        fs.rmSync(testOutputDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should not generate individual card schemas', async () => {
    const generator = new JSONToZodGenerator({
      optionalThreshold: 0.5,
    });

    await generator.generateFromFile(testInputPath, testOutputDir);
    const schemaContent = fs.readFileSync(path.join(testOutputDir, 'schema.ts'), 'utf8');

    assert(!schemaContent.includes('Cards[0]Schema'), 'Should not have Cards[0]Schema');
    assert(!schemaContent.includes('Cards[1]Schema'), 'Should not have Cards[1]Schema');
    assert(!schemaContent.includes('Cards[2]Schema'), 'Should not have Cards[2]Schema');
  });

  test('should generate proper cards array schema', async () => {
    const generator = new JSONToZodGenerator({
      optionalThreshold: 0.5,
    });

    await generator.generateFromFile(testInputPath, testOutputDir);
    const schemaContent = fs.readFileSync(path.join(testOutputDir, 'schema.ts'), 'utf8');

    assert(schemaContent.includes('cards:'), 'Should have cards field');
    assert(
      schemaContent.includes('z.array(CardsItemSchema)'),
      'Cards should use CardsItemSchema in array'
    );
  });

  test('should generate unified CardsItemSchema', async () => {
    const generator = new JSONToZodGenerator({
      optionalThreshold: 0.5,
    });

    await generator.generateFromFile(testInputPath, testOutputDir);
    const schemaContent = fs.readFileSync(path.join(testOutputDir, 'schema.ts'), 'utf8');

    assert(
      schemaContent.includes('const CardsItemSchema = z.object({'),
      'Should have CardsItemSchema definition'
    );
  });

  test('should not mark required fields as optional', async () => {
    const generator = new JSONToZodGenerator({
      optionalThreshold: 0.5,
    });

    await generator.generateFromFile(testInputPath, testOutputDir);
    const schemaContent = fs.readFileSync(path.join(testOutputDir, 'schema.ts'), 'utf8');

    // Since id, name appear in 100% of records, they should not be optional
    assert(!schemaContent.includes('id: z.string().optional()'), 'id should not be optional');
    assert(!schemaContent.includes('name: z.string().optional()'), 'name should not be optional');
  });

  test('should generate valid schema syntax', async () => {
    const generator = new JSONToZodGenerator({
      optionalThreshold: 0.5,
    });

    await generator.generateFromFile(testInputPath, testOutputDir);
    const schemaContent = fs.readFileSync(path.join(testOutputDir, 'schema.ts'), 'utf8');

    assert(!schemaContent.includes('Cards['), 'Should not have invalid bracket syntax');
  });

  test('should generate proper TypeScript types', async () => {
    const generator = new JSONToZodGenerator({
      optionalThreshold: 0.5,
    });

    await generator.generateFromFile(testInputPath, testOutputDir);
    const typesContent = fs.readFileSync(path.join(testOutputDir, 'types.ts'), 'utf8');

    assert(
      typesContent.includes('cards: CardsItem[]'),
      'Should have cards: CardsItem[] in GeneratedRecord'
    );
    assert(
      typesContent.includes('export interface CardsItem {'),
      'Should have CardsItem interface'
    );
  });

  test('should properly type nested object fields', async () => {
    const generator = new JSONToZodGenerator({
      optionalThreshold: 0.5,
    });

    await generator.generateFromFile(testInputPath, testOutputDir);
    const schemaContent = fs.readFileSync(path.join(testOutputDir, 'schema.ts'), 'utf8');

    assert(schemaContent.includes('colors: z.array(z.string())'), 'Colors should be string array');
    assert(schemaContent.includes('setType: z.enum(['), 'SetType should be enum');
  });

  test('should detect datetime fields properly', async () => {
    const generator = new JSONToZodGenerator({
      optionalThreshold: 0.5,
    });

    await generator.generateFromFile(testInputPath, testOutputDir);
    const schemaContent = fs.readFileSync(path.join(testOutputDir, 'schema.ts'), 'utf8');

    assert(
      schemaContent.includes('releasedAt: z.string().datetime()'),
      'ReleasedAt should be datetime'
    );
  });

  test('should generate correct enum values', async () => {
    const generator = new JSONToZodGenerator({
      optionalThreshold: 0.5,
    });

    await generator.generateFromFile(testInputPath, testOutputDir);
    const schemaContent = fs.readFileSync(path.join(testOutputDir, 'schema.ts'), 'utf8');

    assert(
      schemaContent.includes("z.enum(['core', 'expansion'])") ||
        schemaContent.includes('z.enum(["core", "expansion"])'),
      'SetType enum should include core and expansion values'
    );
  });

  test('should generate main record schema structure', async () => {
    const generator = new JSONToZodGenerator({
      optionalThreshold: 0.5,
    });

    await generator.generateFromFile(testInputPath, testOutputDir);
    const schemaContent = fs.readFileSync(path.join(testOutputDir, 'schema.ts'), 'utf8');

    assert(
      schemaContent.includes('export const RecordSchema = z.object({'),
      'Should have RecordSchema export'
    );
    assert(
      schemaContent.includes('export type Record = z.infer<typeof RecordSchema>'),
      'Should have Record type export'
    );
  });

  test('should generate TypeScript interfaces for nested objects', async () => {
    const generator = new JSONToZodGenerator({
      optionalThreshold: 0.5,
    });

    await generator.generateFromFile(testInputPath, testOutputDir);
    const typesContent = fs.readFileSync(path.join(testOutputDir, 'types.ts'), 'utf8');

    assert(
      typesContent.includes('export interface GeneratedRecord {'),
      'Should have GeneratedRecord interface'
    );
    assert(
      typesContent.includes("setType: 'core' | 'expansion';"),
      'Should have union type for setType'
    );
  });
});
