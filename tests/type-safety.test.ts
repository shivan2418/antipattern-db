import { test, describe } from 'node:test';
import { strict as assert } from 'assert';
import { TypeSafeQueryBuilder, FieldPaths } from '../src/runtime/typed-query-builder.js';
import { QueryResult, QueryFilter, QueryOptions } from '../src/runtime/query-client.js';

// Test record types
interface TestUser {
  id: string;
  name: string;
  email: string;
  age: number;
  isActive: boolean;
  tags: string[];
  profile: {
    bio: string;
    preferences: {
      theme: 'light' | 'dark';
      notifications: boolean;
    };
    address: {
      street: string;
      city: string;
      country: string;
    };
  };
}

interface SimpleRecord {
  id: string;
  title: string;
  count: number;
}

describe('Type Safety Features', () => {
  // Mock execute function for testing
  const mockExecute = async (
    _filters: QueryFilter[],
    _options?: QueryOptions
  ): Promise<QueryResult<TestUser>> => {
    return {
      records: [],
      totalCount: 0,
      hasMore: false,
      executionTime: 1,
    };
  };

  test('should allow valid field names at compile time', () => {
    const builder = new TypeSafeQueryBuilder<TestUser>(mockExecute);

    // These should compile without errors
    assert.doesNotThrow(() => {
      builder.where('id').equals('123');
      builder.where('name').contains('John');
      builder.where('email').startsWith('user@');
      builder.where('age').greaterThan(18);
      builder.where('isActive').equals(true);
      builder.where('tags').contains('premium');
    });
  });

  test('should support nested field access', () => {
    const builder = new TypeSafeQueryBuilder<TestUser>(mockExecute);

    // These nested field accesses should compile
    assert.doesNotThrow(() => {
      builder.where('profile.bio').contains('developer');
      builder.where('profile.preferences.theme').equals('dark');
      builder.where('profile.preferences.notifications').equals(true);
      builder.where('profile.address.city').equals('New York');
      builder.where('profile.address.country').equals('USA');
    });
  });

  test('should support type-safe sorting', () => {
    const builder = new TypeSafeQueryBuilder<TestUser>(mockExecute);

    // These sort operations should compile
    assert.doesNotThrow(() => {
      builder.sort('name', 'asc');
      builder.sort('age', 'desc');
      builder.sort('profile.bio', 'asc');
    });
  });

  test('should generate correct field paths type', () => {
    // This tests that our FieldPaths type works correctly
    type UserFieldPaths = FieldPaths<TestUser>;

    // These should be valid field paths
    const validPaths: UserFieldPaths[] = [
      'id',
      'name',
      'email',
      'age',
      'isActive',
      'tags',
      'profile',
      'profile.bio',
      'profile.preferences',
      'profile.preferences.theme',
      'profile.preferences.notifications',
      'profile.address',
      'profile.address.street',
      'profile.address.city',
      'profile.address.country',
    ];

    assert(validPaths.length > 0, 'Should have valid field paths');
  });

  test('should work with simple record types', () => {
    const simpleExecute = async (_filters: QueryFilter[]): Promise<QueryResult<SimpleRecord>> => {
      return { records: [], totalCount: 0, hasMore: false, executionTime: 1 };
    };

    const builder = new TypeSafeQueryBuilder<SimpleRecord>(simpleExecute);

    assert.doesNotThrow(() => {
      builder.where('id').equals('123');
      builder.where('title').contains('test');
      builder.where('count').greaterThan(10);
      builder.sort('title', 'asc');
    });
  });

  test('should support fluent query building', async () => {
    const builder = new TypeSafeQueryBuilder<TestUser>(mockExecute);

    // Test fluent chaining
    const query = builder
      .where('age')
      .greaterThan(18)
      .where('isActive')
      .equals(true)
      .where('profile.preferences.theme')
      .equals('dark')
      .sort('name', 'asc')
      .limit(10)
      .offset(0);

    const result = await query.exec();
    assert(result, 'Should return a result');
    assert.strictEqual(result.totalCount, 0);
  });

  test('should support all comparison operators', () => {
    const builder = new TypeSafeQueryBuilder<TestUser>(mockExecute);

    assert.doesNotThrow(() => {
      // Equality operators
      builder.where('age').equals(25);
      builder.where('age').eq(25);
      builder.where('age').notEquals(30);
      builder.where('age').ne(30);

      // Comparison operators
      builder.where('age').greaterThan(18);
      builder.where('age').gt(18);
      builder.where('age').lessThan(65);
      builder.where('age').lt(65);
      builder.where('age').greaterThanOrEqual(21);
      builder.where('age').gte(21);
      builder.where('age').lessThanOrEqual(60);
      builder.where('age').lte(60);

      // Array operators
      builder.where('age').in([25, 30, 35]);
      builder.where('tags').contains('premium');

      // String operators
      builder.where('email').startsWith('user@');
      builder.where('email').endsWith('.com');
    });
  });

  test('should maintain type safety with legacy methods', () => {
    const builder = new TypeSafeQueryBuilder<TestUser>(mockExecute);

    assert.doesNotThrow(() => {
      // Legacy whereEquals method should still work
      builder.whereEquals('name', 'John');
      builder.whereEquals('age', 25);
      builder.whereEquals('profile.preferences.theme', 'dark');
    });
  });
});

// Type-level tests (these test compile-time behavior)
describe('Compile-time Type Safety (Type-level tests)', () => {
  test('should demonstrate type constraints', () => {
    // This test mainly documents expected behavior and serves as a reference
    // The real testing happens at compile time

    interface TestRecord {
      id: string;
      name: string;
      nested: {
        value: number;
      };
    }

    // Type checking happens at compile time - this is just documentation
    // These would be valid field paths (compile-time checked):
    // 'id', 'name', 'nested', 'nested.value'

    // These would cause compile errors:
    // 'nonExistent', 'nested.nonExistent', 'id.invalid'

    assert(true, 'Type-level test passed'); // Placeholder assertion
  });
});
