# Using the Artist Database Example

This guide shows how to use the `example-artist-query.ts` file to query your Magic: The Gathering artist data.

## Quick Start

### 1. Build the Database

First, build the database from your JSON file:

```bash
# Build the complete queryable database
pnpm run db:build data/artists-with-cards.json -o ./artist-db

# This creates:
# ./artist-db/
# ├── schema.ts           # Zod validation schemas
# ├── types.ts            # TypeScript types  
# ├── index.ts            # Exports
# ├── metadata.json       # Database info
# ├── split-metadata.json # File organization
# ├── data/               # Record files
# └── indexes/            # Query indexes
```

### 2. Run the Example

```bash
# Run the example script
npx tsx example-artist-query.ts

# Or make it executable and run directly
chmod +x example-artist-query.ts
./example-artist-query.ts
```

## What the Example Demonstrates

The example shows various query patterns:

### 📊 Basic Statistics
- Total number of artists
- Available fields
- Indexed fields for fast querying

### 🎯 Filtering Examples
- **Prolific artists**: Find artists with more than 50 cards
- **Name search**: Search for artists with "John" in their name  
- **Date filtering**: Find veteran artists (first card before 2000)
- **Complex queries**: Multiple filters combined

### 📄 Advanced Features
- **Pagination**: Browse results in pages
- **Sorting**: Order by different fields (name, card count, date)
- **Performance**: Timing information for queries
- **Type safety**: Full TypeScript support with generated types

### 🔍 Query Operators

The example demonstrates various query operators:

```typescript
// Equality
.where('cardCount').equals(50)
.where('name').equals('John Doe')

// Comparison  
.where('cardCount').greaterThan(50)
.where('oldestCardDate').lessThan('2000-01-01T00:00:00.000Z')

// String matching
.where('name').contains('John')
.where('name').startsWith('A')

// Array operations
.where('colors').contains('red')
.where('artistIds').in(['uuid1', 'uuid2'])
```

## Example Output

When you run the script, you'll see output like:

```
🎨 Magic: The Gathering Artist Database Example

📊 Database Statistics:
   Total Artists: 1866
   Available Fields: name, oldestCardDate, cardCount, cards
   Indexed Fields: name, cardCount, oldestCardDate

🎯 Finding prolific artists (>50 cards):
Found 23 prolific artists:
   1. Rebecca Guay - 127 cards
   2. Matt Cavotta - 89 cards
   3. Carl Critchlow - 78 cards
   ...

🔍 Searching for artists with "John" in their name:
Found 15 artists:
   • John Avon (45 cards)
   • John Matson (12 cards)
   • John Stanko (8 cards)

⚡ Query Performance:
   Query returned 100 results in 15ms
   Database execution time: 12ms
```

## Using in Your Own Code

Import and use the functions in your own TypeScript files:

```typescript
import { AntipatternDB } from './src/runtime/query-client.js';
import type { GeneratedRecord } from './generated-test/types.js';

async function findTopArtists() {
  const db = new AntipatternDB('./artist-db');
  await db.init();
  
  const result = await db
    .query<GeneratedRecord>()
    .where('cardCount').greaterThan(20)
    .sort('cardCount', 'desc')
    .limit(10)
    .exec();
    
  return result.records;
}
```

## Validation with Zod

Use the generated schema to validate data:

```typescript
import { RecordSchema } from './generated-test/schema.js';

// Validate API responses
const artistData = await fetch('/api/artist/123').then(r => r.json());
const validArtist = RecordSchema.parse(artistData);

// Safe parsing with error handling
const result = RecordSchema.safeParse(artistData);
if (result.success) {
  console.log('Valid artist:', result.data.name);
} else {
  console.error('Validation failed:', result.error);
}
```

## Next Steps

- Explore the generated `./artist-db/` folder to understand the file structure
- Check the `metadata.json` file for database statistics
- Look at `indexes/` folder to see how fields are indexed
- Experiment with different query combinations
- Build your own application using the query client 