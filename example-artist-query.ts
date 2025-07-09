#!/usr/bin/env tsx

/**
 * Example: Using Antipattern-DB with Magic: The Gathering Artist Data
 * 
 * This example demonstrates how to use the generated client to query
 * Magic: The Gathering artist data from the artists-with-cards.json file.
 */

import { AntipatternDB } from './src/runtime/query-client.js';
import { RecordSchema } from './generated-test/schema.js';
import type { GeneratedRecord, CardsItem } from './generated-test/types.js';

// Type alias for better readability
type Artist = GeneratedRecord;
type Card = CardsItem;
type SchemaRecord = import('./generated-test/schema.js').Record;

async function main() {
  console.log('🎨 Magic: The Gathering Artist Database Example\n');

  // Step 1: First, you need to build the database from your JSON file
  console.log('📋 To use this example, first build the database:');
  console.log('   pnpm run db:build data/artists-with-cards.json -o ./artist-db\n');

  try {
    // Step 2: Initialize the database client
    console.log('🔌 Connecting to artist database...');
    const db = new AntipatternDB('./artist-db');
    await db.init();
    
    console.log('✅ Database connected successfully!\n');

    // Step 3: Get basic statistics
    console.log('📊 Database Statistics:');
    const stats = await db.getStats();
    const totalArtists = await db.count();
    const fields = await db.getFields();
    const indexedFields = await db.getIndexedFields();

    console.log(`   Total Artists: ${totalArtists}`);
    console.log(`   Available Fields: ${fields.join(', ')}`);
    console.log(`   Indexed Fields: ${indexedFields.join(', ')}\n`);

    // Step 4: Query examples

    // Example 1: Find prolific artists (those with many cards)
    console.log('🎯 Finding prolific artists (>50 cards):');
    const prolificArtists = await db
      .query<Artist>()
      .where('cardCount').greaterThan(50)
      .sort('cardCount', 'desc')
      .limit(5)
      .exec();

    console.log(`Found ${prolificArtists.totalCount} prolific artists:`);
    prolificArtists.records.forEach((artist, index) => {
      console.log(`   ${index + 1}. ${artist.name} - ${artist.cardCount} cards`);
    });
    console.log();

    // Example 2: Find artists by name pattern
    console.log('🔍 Searching for artists with "John" in their name:');
    const johnArtists = await db
      .query<Artist>()
      .where('name').contains('John')
      .sort('name', 'asc')
      .exec();

    console.log(`Found ${johnArtists.totalCount} artists:`);
    johnArtists.records.slice(0, 3).forEach((artist) => {
      console.log(`   • ${artist.name} (${artist.cardCount} cards)`);
    });
    console.log();

    // Example 3: Find veteran artists (oldest card before 2000)
    console.log('👴 Finding veteran artists (oldest card before 2000):');
    const veteranArtists = await db
      .query<Artist>()
      .where('oldestCardDate').lessThan('2000-01-01T00:00:00.000Z')
      .sort('oldestCardDate', 'asc')
      .limit(5)
      .exec();

    console.log(`Found ${veteranArtists.totalCount} veteran artists:`);
    veteranArtists.records.forEach((artist) => {
      const oldestDate = new Date(artist.oldestCardDate).getFullYear();
      console.log(`   • ${artist.name} - First card: ${oldestDate}`);
    });
    console.log();

    // Example 4: Get a specific artist by searching
    console.log('👤 Getting details for a specific artist:');
    const searchResult = await db
      .query<Artist>()
      .where('cardCount').greaterThan(30)
      .limit(1)
      .exec();

    if (searchResult.records.length > 0) {
      const artist = searchResult.records[0];
      console.log(`   Artist: ${artist.name}`);
      console.log(`   Total Cards: ${artist.cardCount}`);
      console.log(`   First Card: ${new Date(artist.oldestCardDate).getFullYear()}`);
      
      // Show some card examples
      console.log(`   Sample Cards:`);
      artist.cards.slice(0, 3).forEach((card) => {
        console.log(`     - ${card.name} (${card.set}) - ${new Date(card.releasedAt).getFullYear()}`);
      });
    }
    console.log();

    // Example 5: Complex query with multiple filters
    console.log('🔍 Complex query - Modern prolific artists:');
    const modernProlific = await db
      .query<Artist>()
      .where('cardCount').greaterThan(20)
      .where('oldestCardDate').greaterThan('2010-01-01T00:00:00.000Z')
      .sort('cardCount', 'desc')
      .limit(3)
      .exec();

    console.log(`Artists with 20+ cards who started after 2010:`);
    modernProlific.records.forEach((artist) => {
      const startYear = new Date(artist.oldestCardDate).getFullYear();
      console.log(`   • ${artist.name} - ${artist.cardCount} cards (since ${startYear})`);
    });
    console.log();

    // Example 6: Query performance timing
    console.log('⚡ Query Performance:');
    const start = Date.now();
    const performanceTest = await db
      .query<Artist>()
      .where('cardCount').greaterThanOrEqual(10)
      .sort('name', 'asc')
      .limit(100)
      .exec();
    const queryTime = Date.now() - start;
    
    console.log(`   Query returned ${performanceTest.records.length} results in ${queryTime}ms`);
    console.log(`   Database execution time: ${performanceTest.executionTime}ms\n`);

    // Example 7: Pagination example
    console.log('📄 Pagination example - browsing artists:');
    const pageSize = 5;
    const firstPage = await db
      .query<Artist>()
      .sort('cardCount', 'desc')
      .limit(pageSize)
      .offset(0)
      .exec();

    const secondPage = await db
      .query<Artist>()
      .sort('cardCount', 'desc')
      .limit(pageSize)
      .offset(pageSize)
      .exec();

    console.log('   Page 1 (Top artists by card count):');
    firstPage.records.forEach((artist, index) => {
      console.log(`     ${index + 1}. ${artist.name} - ${artist.cardCount} cards`);
    });

    console.log('   Page 2:');
    secondPage.records.forEach((artist, index) => {
      console.log(`     ${index + 6}. ${artist.name} - ${artist.cardCount} cards`);
    });

    console.log(`\n   Total pages available: ${Math.ceil(firstPage.totalCount / pageSize)}`);

  } catch (error) {
    if (error instanceof Error && error.message.includes('Database directory not found')) {
      console.log('❌ Database not found!');
      console.log('\n🔧 To create the database, run:');
      console.log('   pnpm run db:build data/artists-with-cards.json -o ./artist-db');
      console.log('\n   This will:');
      console.log('   • Generate Zod schemas and TypeScript types');
      console.log('   • Split the large JSON into optimized files');
      console.log('   • Create indexes for fast querying');
      console.log('   • Set up metadata for the query engine');
    } else {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
    }
  }
}

// Additional helper functions for working with the artist data

/**
 * Helper function to analyze an artist's card distribution by set type
 */
function analyzeArtistCardDistribution(artist: Artist): void {
  const setTypeCounts: Record<string, number> = {};
  
  artist.cards.forEach(card => {
    setTypeCounts[card.setType] = (setTypeCounts[card.setType] || 0) + 1;
  });

  console.log(`\n📊 ${artist.name}'s Card Distribution:`);
  Object.entries(setTypeCounts)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .forEach(([setType, count]) => {
      console.log(`   ${setType}: ${count} cards`);
    });
}

/**
 * Helper function to find cards with specific characteristics
 */
async function findSpecialCards(db: AntipatternDB): Promise<void> {
  console.log('✨ Looking for special characteristics in the data...\n');

  // This would require querying individual card data if cards were indexed separately
  // For now, we'll demonstrate with artist-level queries
  
  const fullArtArtists = await db
    .query<Artist>()
    .where('cardCount').greaterThan(5) // Artists with multiple cards
    .exec();

  console.log(`Analyzed ${fullArtArtists.records.length} artists for special card characteristics`);
  
  // Analyze a sample artist's cards
  if (fullArtArtists.records.length > 0) {
    const sampleArtist = fullArtArtists.records[0];
    const fullArtCards = sampleArtist.cards.filter(card => card.fullArt);
    const borderlessCards = sampleArtist.cards.filter(card => card.borderColor === 'borderless');
    
    console.log(`   ${sampleArtist.name} has:`);
    console.log(`   • ${fullArtCards.length} full-art cards`);
    console.log(`   • ${borderlessCards.length} borderless cards`);
  }
}

/**
 * Validation example using the generated Zod schema
 */
function validateArtistData(artistData: unknown): SchemaRecord | null {
  try {
    const validatedArtist = RecordSchema.parse(artistData);
    console.log(`✅ Artist data is valid: ${validatedArtist.name}`);
    return validatedArtist;
  } catch (error) {
    console.error('❌ Invalid artist data:', error);
    return null;
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  main,
  analyzeArtistCardDistribution,
  findSpecialCards,
  validateArtistData,
  type Artist,
  type Card
}; 