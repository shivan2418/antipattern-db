import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import JSONToZodGenerator from '../src/jsontozod';

describe('Nested Types Generation', () => {
  const testOutputDir = './test-output-nested';

  test('should generate proper nested types for complex JSON structure', async () => {
    // Clean up any existing test output
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }

    const generator = new JSONToZodGenerator();
    await generator.generateFromFile('test-data-nested.json', testOutputDir);

    // Verify files were created
    assert.ok(fs.existsSync(path.join(testOutputDir, 'schema.ts')), 'schema.ts should be created');
    assert.ok(fs.existsSync(path.join(testOutputDir, 'types.ts')), 'types.ts should be created');
    assert.ok(fs.existsSync(path.join(testOutputDir, 'index.ts')), 'index.ts should be created');

    // Read generated files
    const schemaContent = fs.readFileSync(path.join(testOutputDir, 'schema.ts'), 'utf8');
    const typesContent = fs.readFileSync(path.join(testOutputDir, 'types.ts'), 'utf8');

    // Verify nested schemas are generated
    assert.ok(
      schemaContent.includes('const AddressCoordinatesSchema'),
      'AddressCoordinatesSchema should be generated'
    );
    assert.ok(
      schemaContent.includes('const PreferencesNotificationsSchema'),
      'PreferencesNotificationsSchema should be generated'
    );
    assert.ok(
      schemaContent.includes('const MetadataSessionSchema'),
      'MetadataSessionSchema should be generated'
    );
    assert.ok(schemaContent.includes('const AddressSchema'), 'AddressSchema should be generated');
    assert.ok(
      schemaContent.includes('const PreferencesSchema'),
      'PreferencesSchema should be generated'
    );
    assert.ok(schemaContent.includes('const MetadataSchema'), 'MetadataSchema should be generated');

    // Verify main schema references nested schemas (not generic z.record)
    assert.ok(
      schemaContent.includes('address: AddressSchema'),
      'address should reference AddressSchema'
    );
    assert.ok(
      schemaContent.includes('preferences: PreferencesSchema'),
      'preferences should reference PreferencesSchema'
    );
    assert.ok(
      schemaContent.includes('metadata: MetadataSchema'),
      'metadata should reference MetadataSchema'
    );

    // Verify nested schema compositions
    assert.ok(
      schemaContent.includes('coordinates: AddressCoordinatesSchema'),
      'AddressSchema should reference AddressCoordinatesSchema'
    );
    assert.ok(
      schemaContent.includes('notifications: PreferencesNotificationsSchema'),
      'PreferencesSchema should reference PreferencesNotificationsSchema'
    );
    assert.ok(
      schemaContent.includes('session: MetadataSessionSchema'),
      'MetadataSchema should reference MetadataSessionSchema'
    );

    // Verify no generic fallbacks in main schema
    assert.ok(
      !schemaContent.includes('address: z.record(z.unknown())'),
      'address should not use generic z.record'
    );
    assert.ok(
      !schemaContent.includes('preferences: z.record(z.unknown())'),
      'preferences should not use generic z.record'
    );
    assert.ok(
      !schemaContent.includes('metadata: z.record(z.unknown())'),
      'metadata should not use generic z.record'
    );

    // Verify nested TypeScript interfaces are generated
    assert.ok(
      typesContent.includes('export interface AddressCoordinates'),
      'AddressCoordinates interface should be generated'
    );
    assert.ok(
      typesContent.includes('export interface PreferencesNotifications'),
      'PreferencesNotifications interface should be generated'
    );
    assert.ok(
      typesContent.includes('export interface MetadataSession'),
      'MetadataSession interface should be generated'
    );
    assert.ok(
      typesContent.includes('export interface Address'),
      'Address interface should be generated'
    );
    assert.ok(
      typesContent.includes('export interface Preferences'),
      'Preferences interface should be generated'
    );
    assert.ok(
      typesContent.includes('export interface Metadata'),
      'Metadata interface should be generated'
    );

    // Verify main interface references nested interfaces (not generic Record<string, unknown>)
    assert.ok(
      typesContent.includes('address: Address'),
      'GeneratedRecord.address should reference Address interface'
    );
    assert.ok(
      typesContent.includes('preferences: Preferences'),
      'GeneratedRecord.preferences should reference Preferences interface'
    );
    assert.ok(
      typesContent.includes('metadata: Metadata'),
      'GeneratedRecord.metadata should reference Metadata interface'
    );

    // Verify nested interface compositions
    assert.ok(
      typesContent.includes('coordinates: AddressCoordinates'),
      'Address interface should reference AddressCoordinates'
    );
    assert.ok(
      typesContent.includes('notifications: PreferencesNotifications'),
      'Preferences interface should reference PreferencesNotifications'
    );
    assert.ok(
      typesContent.includes('session: MetadataSession'),
      'Metadata interface should reference MetadataSession'
    );

    // Verify no generic fallbacks in main interface
    assert.ok(
      !typesContent.match(/address:\s*Record<string,\s*unknown>/),
      'address should not use generic Record type'
    );
    assert.ok(
      !typesContent.match(/preferences:\s*Record<string,\s*unknown>/),
      'preferences should not use generic Record type'
    );
    assert.ok(
      !typesContent.match(/metadata:\s*Record<string,\s*unknown>/),
      'metadata should not use generic Record type'
    );

    // Clean up test output
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  test('should generate correct field types based on JSON data', async () => {
    const generator = new JSONToZodGenerator();
    await generator.generateFromFile('test-data-nested.json', testOutputDir);

    const schemaContent = fs.readFileSync(path.join(testOutputDir, 'schema.ts'), 'utf8');

    // Verify primitive field types
    assert.ok(schemaContent.includes('id: z.string()'), 'id should be string');
    assert.ok(
      schemaContent.includes('email: z.string().email()'),
      'email should have email validation'
    );
    assert.ok(schemaContent.includes('age: z.number().int()'), 'age should be integer');
    assert.ok(schemaContent.includes('roles: z.array(z.string())'), 'roles should be string array');

    // Verify nested object field types
    assert.ok(
      schemaContent.includes('latitude: z.number()'),
      'coordinates.latitude should be number'
    );
    assert.ok(
      schemaContent.includes('elevation: z.number().int()'),
      'coordinates.elevation should be integer'
    );
    assert.ok(
      schemaContent.includes('email: z.boolean()'),
      'notifications.email should be boolean'
    );
    assert.ok(
      schemaContent.includes('expires: z.string().datetime()'),
      'session.expires should be datetime string'
    );

    // Clean up test output
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  test('should validate generated schema against sample data', async () => {
    const generator = new JSONToZodGenerator();
    await generator.generateFromFile('test-data-nested.json', testOutputDir);

    // Import and test the generated schema
    const { RecordSchema } = await import(path.resolve(testOutputDir, 'schema.js'));
    const testDataJson = fs.readFileSync('test-data-nested.json', 'utf8');
    const testData = JSON.parse(testDataJson);

    // Test validation against the actual data
    for (const record of testData) {
      try {
        const validatedRecord = RecordSchema.parse(record);
        assert.ok(validatedRecord, 'Record should validate successfully');
      } catch (error) {
        assert.fail(`Record validation failed: ${error}`);
      }
    }

    // Clean up test output
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  });
});
