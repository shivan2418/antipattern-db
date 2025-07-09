#!/usr/bin/env tsx

/**
 * Example: Using Antipattern-DB with Magic: The Gathering Artist Data
 *
 * This example demonstrates how to use the generated client to query
 * Magic: The Gathering artist data from the artists-with-cards.json file.
 */

/* eslint-disable no-console */
/* eslint-disable no-undef */

import { AntipatternDB } from './src';

// Example of record type (would be generated)
interface Artist {
  id: string;
  name: string;
  cardCount: number;
  oldestCardDate: string;
  cards: string[];
  profile?: {
    bio: string;
    website: string;
    verified: boolean;
  };
}

async function main() {
  console.log('🎨 Magic: The Gathering Artist Database Example\n');

  // Step 1: First, you need to build the database from your JSON file
  console.log('📋 To use this example, first build the database:');
  console.log('   pnpm run db:build data/artists-with-cards.json -o ./artist-db\n');

  try {
    // Step 2: Initialize the database client
    console.log('🔌 Connecting to artist database...');
    
    // For demonstration, we'll use the regular client since we don't have generated types here
    // In a real scenario, you'd import the generated type-safe client:
    // import { db } from './artist-db';
    // await db.init();
    
    const db = new AntipatternDB('./artist-db');
    await db.init();

    console.log('✅ Database connected successfully!\n');

    await db.query().where('foo').contains('abc')

    // Step 3: Get basic statistics
    console.log('📊 Database Statistics:');
    const totalArtists = await db.count();
    const fields = await db.getFields();
    const indexedFields = await db.getIndexedFields();

    console.log(`   Total Artists: ${totalArtists}`);
    console.log(`   Available Fields: ${fields.join(', ')}`);
    console.log(`   Indexed Fields: ${indexedFields.join(', ')}\n`);

    // Step 4: Query examples with type safety demonstration

    console.log('🔒 Type Safety Demonstration:');
    console.log('When using the generated type-safe client, these would be the differences:\n');

    console.log('✅ TYPE-SAFE VERSION (with generated client):');
    console.log(`   import { db } from './artist-db';
   
   // ✅ These work - field names are validated at compile time:
   const results = await db.query()
     .where('cardCount').greaterThan(50)     // ✅ 'cardCount' exists
     .where('name').contains('John')         // ✅ 'name' exists  
     .where('profile.verified').equals(true) // ✅ nested fields work
     .exec();
   
   // ❌ These would cause TypeScript compile errors:
   // .where('nonExistentField').equals('value')  // ❌ Compile error!
   // .where('cardCont').greaterThan(50)          // ❌ Typo caught at compile time!
   // .where('profile.age').equals(30)            // ❌ 'age' doesn't exist in profile!
`);

    console.log('\n📊 Current Example (using regular client for demo):');

    // Example 1: Find prolific artists (those with many cards)
    console.log('🎯 Finding prolific artists (>50 cards):');
    const prolificArtists = await db
      .query<Artist>()
      .where('cardCount')
      .greaterThan(50)
      .sort('cardCount', 'desc')
      .limit(5)
      .exec();

    console.log(`Found ${prolificArtists.totalCount} prolific artists:`);
    prolificArtists.records.forEach((artist: Artist, index: number) => {
      console.log(`   ${index + 1}. ${artist.name} - ${artist.cardCount} cards`);
    });
    console.log();

    // Example 2: Find artists by name pattern
    console.log('🔍 Searching for artists with "John" in their name:');
    const johnArtists = await db
      .query<Artist>()
      .where('name')
      .contains('John')
      .sort('name', 'asc')
      .exec();

    console.log(`Found ${johnArtists.totalCount} artists:`);
    johnArtists.records.slice(0, 5).forEach((artist: Artist) => {
      console.log(`   • ${artist.name} (${artist.cardCount} cards)`);
    });
    console.log();

    // Example 3: Complex multi-field query
    console.log('⚡ Complex query - Artists with 15-100 cards from after 2000:');
    const modernProlificArtists = await db
      .query<Artist>()
      .where('cardCount')
      .greaterThan(15)
      .where('cardCount')
      .lessThan(100)
      .where('oldestCardDate')
      .greaterThan('2000-01-01T00:00:00.000Z')
      .sort('cardCount', 'desc')
      .limit(10)
      .exec();

    console.log(`Found ${modernProlificArtists.totalCount} matching artists:`);
    modernProlificArtists.records.forEach((artist: Artist, index: number) => {
      const oldestDate = new Date(artist.oldestCardDate).getFullYear();
      console.log(`   ${index + 1}. ${artist.name} - ${artist.cardCount} cards (oldest: ${oldestDate})`);
    });
    console.log();

    console.log('🎉 Query Performance:');
    console.log(`   Last query returned ${modernProlificArtists.records.length} results in ${modernProlificArtists.executionTime}ms`);

    console.log('\n🔥 Benefits of Type-Safe Version:');
    console.log('   ✅ Compile-time field validation');
    console.log('   ✅ IntelliSense autocomplete for field names');
    console.log('   ✅ Catches typos before runtime');
    console.log('   ✅ Supports nested field access (profile.verified)');
    console.log('   ✅ Value type checking based on field types');
    console.log('   ✅ Prevents queries on non-existent fields');

  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n💡 Make sure to build the database first:');
    console.log('   pnpm run db:build data/artists-with-cards.json -o ./artist-db');
  }
}

main().catch(console.error);
