import { db, ValidFieldNames } from './artist-db/client.js';
import { QueryOperator } from './src/runtime/query-client.js';

/**
 * Type Safety Demonstration
 * 
 * This script demonstrates the compile-time type safety features.
 * Try uncommenting the commented lines to see TypeScript errors!
 */

async function demonstrateTypeSafety() {
  console.log('🔒 Type Safety Demonstration\n');
  
  try {
    // Initialize the database
    console.log('📡 Connecting to type-safe database...');
    await db.init();
    console.log('✅ Connected successfully!\n');

    // ✅ VALID QUERIES - These work because field names exist
    console.log('✅ VALID QUERIES:');
    
    console.log('1. Querying artists with high card counts...');
    const prolificArtists = await db
      .query()
      .where('cardCount')          // ✅ 'cardCount' exists in GeneratedRecord
      .greaterThan(50)
      .sort('cardCount', 'desc')   // ✅ Sort field is also type-checked
      .limit(3)
      .exec();
    
    console.log(`   Found ${prolificArtists.totalCount} artists with >50 cards`);
    prolificArtists.records.forEach((artist, i) => {
      console.log(`   ${i + 1}. ${artist.name} - ${artist.cardCount} cards`);
    });
    console.log();

    console.log('2. Searching by name pattern...');
    const johnArtists = await db
      .query()
      .where('name')               // ✅ 'name' exists
      .contains('John')
      .sort('name', 'asc')
      .exec();
    
    console.log(`   Found ${johnArtists.totalCount} artists with 'John' in name`);
    johnArtists.records.slice(0, 3).forEach(artist => {
      console.log(`   • ${artist.name} (${artist.cardCount} cards)`);
    });
    console.log();

    console.log('3. Nested field access for card data...');
    const modernArtists = await db
      .query()
      .where('oldestCardDate')     // ✅ Top-level field
      .greaterThan('2010-01-01T00:00:00.000Z')
      .sort('cardCount', 'desc')
      .limit(3)
      .exec();
    
    console.log(`   Found ${modernArtists.totalCount} artists who started after 2010`);
    modernArtists.records.forEach(artist => {
      const year = new Date(artist.oldestCardDate).getFullYear();
      console.log(`   • ${artist.name} - Started ${year} (${artist.cardCount} cards)`);
    });
    console.log();

    // Show available field names
    console.log('📋 Available Field Names (type-checked):');
    console.log('   Top-level: name, oldestCardDate, cardCount, cards');
    console.log('   Nested: cards.id, cards.name, cards.setType, cards.artist, etc.\n');

    // ❌ THESE WOULD CAUSE COMPILE ERRORS if uncommented:
    console.log('❌ INVALID QUERIES (would cause TypeScript compile errors):');
    console.log('   // Uncomment these lines to see TypeScript errors:');
    console.log(`   
    // ❌ Error: Argument of type "nonExistentField" is not assignable...
    // await db.query().where("nonExistentField").equals("value").exec();
    
    // ❌ Error: Argument of type "cardCont" is not assignable...  
    // await db.query().where("cardCont").greaterThan(50).exec(); // typo!
    
    // ❌ Error: Argument of type "artist.invalidField" is not assignable...
    // await db.query().where("artist.invalidField").equals("test").exec();
    
    // ❌ Error: Argument of type "invalidSort" is not assignable...
    // await db.query().sort("invalidSort", "asc").exec();
    `);
    console.log();

    console.log('🎯 Type Safety Benefits:');
    console.log('   ✅ Field names validated at compile time');
    console.log('   ✅ IntelliSense autocomplete in your IDE');
    console.log('   ✅ Typos caught before runtime');
    console.log('   ✅ Refactoring safety');
    console.log('   ✅ Self-documenting code');
    
    // Type information at compile time
    type AvailableFields = ValidFieldNames;
    console.log('\n📚 All valid field paths are defined in the ValidFieldNames type alias.');

  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n💡 Make sure the database exists. Build it with:');
    console.log('   pnpm run db:build data/artists-deduplicated.json -o ./artist-db --primary-key name');
  }
}

// Additional examples for different scenarios
async function advancedTypeSafetyExamples() {
  console.log('\n🚀 Advanced Type Safety Examples:\n');
  
  await db.init();

  // Example: Fluent chaining with multiple constraints
  console.log('1. Complex multi-condition query:');
  const complexQuery = await db
    .query()
    .where('cardCount').greaterThan(10)      // ✅ Number comparison
    .where('cardCount').lessThan(100)        // ✅ Chained conditions
    .where('oldestCardDate').greaterThan('2000-01-01T00:00:00.000Z')  // ✅ String comparison
    .sort('cardCount', 'desc')               // ✅ Type-safe sorting  
    .limit(5)
    .exec();

  console.log(`   Found ${complexQuery.totalCount} artists with 10-100 cards from after 2000`);
  console.log();

  // Example: All available operators
  console.log('2. Available operators (all type-safe):');
  console.log('   .equals(), .notEquals(), .greaterThan(), .lessThan()');
  console.log('   .greaterThanOrEqual(), .lessThanOrEqual(), .in(), .contains()');
  console.log('   .startsWith(), .endsWith()');
  console.log('   Short aliases: .eq(), .ne(), .gt(), .lt(), .gte(), .lte()');
  console.log();

  // Example: Legacy compatibility
  console.log('3. Legacy methods (for backward compatibility):');
  const legacyQuery = await db
    .query()
    .whereEquals('cardCount', 50)                               // ✅ Still type-safe
    .whereRaw('name', QueryOperator.CONTAINS, 'Smith')          // ✅ Raw method available
    .exec();
  
  console.log(`   Legacy query found ${legacyQuery.totalCount} results`);
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateTypeSafety()
    .then(() => advancedTypeSafetyExamples())
    .catch(console.error);
}

export { demonstrateTypeSafety, advancedTypeSafetyExamples }; 