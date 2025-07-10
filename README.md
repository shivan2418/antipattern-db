# Antipattern-DB - Static File Database

A powerful TypeScript library that converts large JSON files into a queryable, static file database optimized for static hosting environments like GitHub Pages and Vercel. Build type-safe, indexed databases that work entirely on the client-side.

## Features

### 🔒 **True Type Safety**

- **Field name validation at compile time** - No more typos in queries!
- **IntelliSense autocomplete** for all available field names
- **Nested field support** (e.g., `'profile.preferences.theme'`) up to 3 levels deep
- **Value type checking** based on your actual data structure
- **Compile-time errors** for non-existent fields prevent runtime issues

### 🔍 **Schema Introspection**

- Smart analysis of JSON structure and automatic Zod schema generation
- Type detection for emails, URLs, UUIDs, dates, and more
- Enum detection for fields with limited unique values
- Handles complex nested objects and arrays

### 📂 **Data Splitting**

- Splits large JSON files into individual or batched record files
- Optimized file sizes for HTTP requests and static hosting
- Configurable batch sizes and subdirectory organization
- Consistent naming conventions and metadata tracking

### 📊 **Index Generation**

- Creates efficient lookup indexes for all queryable fields
- Supports primitive types, arrays, and nested object fields
- Intelligent filtering (skips fields with too many unique values)
- Primary key indexes and custom field selection

### 🏗️ **Static Database Builder**

- Complete build pipeline from JSON to queryable database
- **Generates ready-to-import, type-safe database client**
- Validation and consistency checking
- Comprehensive metadata and build manifests
- Performance optimized for large datasets

## Installation

```bash
# Install dependencies
pnpm install

# tsx is already included as a dev dependency
```

## Usage

### Command Line Interface

```bash
# Build a complete queryable database from JSON
pnpm run db:build <input.json> [options]

# Using npx directly
npx antipattern-db build <input.json> [options]

# Examples
pnpm run db:build data/users.json -o ./database
npx antipattern-db build data/products.json --output ./db --batch-size 50
pnpm run db:build data/large-dataset.json -o ./static-db --index-fields id,status,category

# Validate and inspect database
pnpm run db:validate ./database
pnpm run db:info ./database
```

### Available CLI Commands

- `build` - Build complete database from JSON file
- `validate` - Validate database structure and consistency
- `info` - Show database information and statistics
- `generate` - Legacy alias for build command

### CLI Options

- `-o, --output <dir>` - Output directory (default: './db')
- `-p, --primary-key <field>` - Primary key field (default: 'id')
- `-b, --batch-size <size>` - Records per file (default: 1)
- `-i, --index-fields <fields>` - Comma-separated fields to index
- `--max-index-values <count>` - Skip indexing fields with too many values
- `--sample-size <size>` - Records to analyze for schema (default: 1000)
- `--enum-threshold <count>` - Max unique values for enums (default: 20)
- `--optional-threshold <ratio>` - Threshold for optional fields (default: 0.5)
- `--no-subdirectories` - Disable subdirectory organization
- `-q, --quiet` - Suppress verbose output

### Runtime Query Client

```typescript
import { db } from './database';

// Initialize database client (pre-configured with types)
await db.init();

// ✅ TYPE-SAFE QUERIES - Field names are validated at compile time!
const user = await db.get('user-123');
const activeUsers = await db.query().where('status').equals('active').exec();

// ✅ Advanced type-safe queries with multiple filters
const results = await db
  .query()
  .where('age') // ✅ Only allows fields that exist in your data
  .greaterThan(25)
  .where('status') // ✅ IntelliSense autocomplete for field names
  .equals('active')
  .where('roles') // ✅ Array field support
  .contains('admin')
  .where('profile.preferences.theme') // ✅ Nested field access (up to 3 levels)
  .equals('dark')
  .sort('name', 'asc') // ✅ Sort field names are also type-checked
  .limit(10)
  .offset(20)
  .exec();

// ❌ These would cause TypeScript compile errors:
// .where('nonExistentField').equals('value')  // Compile error!
// .where('statu').equals('active')            // Typo caught at compile time!
// .where('profile.nonExistent').equals('x')   // Invalid nested field error!

console.log(`Found ${results.totalCount} matching records`);
console.log(`Query executed in ${results.executionTime}ms`);

// Utility methods
const totalUsers = await db.count();
const fields = await db.getFields();
const indexedFields = await db.getIndexedFields();
```

### Type Safety Benefits

The generated database client provides **true compile-time type safety**:

#### ✅ Valid Queries (These work!)

```typescript
// Field names are constrained to actual record properties
await db.query().where('id').equals('user-123').exec();
await db.query().where('email').contains('@gmail.com').exec();
await db.query().where('profile.age').greaterThan(18).exec();
await db.query().where('tags').contains('premium').exec();

// IntelliSense provides autocomplete for all available fields
await db.query().where('status').in(['active', 'pending']).exec();
await db.query().sort('createdAt', 'desc').limit(10).exec();
```

#### ❌ Invalid Queries (Compile-time errors!)

```typescript
// ❌ TypeScript Error: Argument of type '"nonExistentField"' is not assignable...
await db.query().where('nonExistentField').equals('value').exec();

// ❌ TypeScript Error: Typo in field name
await db.query().where('emai').contains('@gmail.com').exec();

// ❌ TypeScript Error: Invalid nested field
await db.query().where('profile.invalidField').equals('value').exec();

// ❌ TypeScript Error: Wrong sort field
await db.query().sort('nonExistentField', 'asc').exec();
```

#### 🎯 Developer Experience Benefits

- **Catch errors at build time**, not runtime
- **IntelliSense autocomplete** shows you exactly what fields are available
- **Refactoring safety** - rename a field in your data and TypeScript will show you everywhere it's used
- **Documentation** - the types serve as living documentation of your data structure
- **Confidence** - know that your queries are valid before deploying

### Database Builder Usage

```typescript
import { AntipatternBuilder } from 'antipattern-db';

const builder = new AntipatternBuilder({
  outputDir: './static-db',
  primaryKeyField: 'id',
  batchSize: 100, // Records per file
  indexFields: ['status', 'category', 'tags'], // Fields to index
  verbose: true,
});

// Build complete database with type-safe client
const result = await builder.build('./data/large-dataset.json');
console.log(`Built database with ${result.totalRecords} records`);

// Now you can use the generated client:
// import { db } from './static-db';
// await db.init();
// const results = await db.query().where('status').equals('active').exec();

// Validate database structure
const isValid = await builder.validate('./static-db');

// Get database information
const info = await builder.info('./static-db');
console.log('Database info:', info);
```

### Schema Generation Only

```typescript
import JSONToZodGenerator from './src/jsontozod.js';

const generator = new JSONToZodGenerator({
  sampleSize: 1000, // Number of records to analyze
  enumThreshold: 20, // Max unique values to create enum
  optionalThreshold: 0.9, // Threshold for optional fields
});

const result = await generator.generateFromFile('./data.json', './output');
console.log(result.stats);
```

## Configuration Options

### Builder Options

| Option              | Type     | Default | Description                                    |
| ------------------- | -------- | ------- | ---------------------------------------------- |
| `outputDir`         | string   | -       | Directory for generated database files         |
| `primaryKeyField`   | string   | 'id'    | Field to use as record identifier              |
| `batchSize`         | number   | 1       | Records per file (1 = individual files)        |
| `indexFields`       | string[] | -       | Specific fields to index (default: all fields) |
| `maxIndexValues`    | number   | 10000   | Skip indexing fields with more unique values   |
| `useSubdirectories` | boolean  | true    | Organize files into subdirectories             |
| `sampleSize`        | number   | 1000    | Records to analyze for schema generation       |
| `enumThreshold`     | number   | 20      | Max unique values for enum creation            |
| `optionalThreshold` | number   | 0.5     | Threshold for marking fields as optional       |

### Example Configuration

```typescript
const builder = new AntipatternBuilder({
  outputDir: './my-database',
  primaryKeyField: 'uuid',
  batchSize: 50, // 50 records per file for better performance
  indexFields: ['status', 'category', 'userId'], // Only index these fields
  maxIndexValues: 5000, // Skip fields with >5000 unique values
  useSubdirectories: true,
  enumThreshold: 15, // Create enums for fields with ≤15 unique values
  optionalThreshold: 0.8, // Make optional if present in <80% of records
  verbose: true,
});
```

### Schema Generator Options

| Option              | Type   | Default | Description                                           |
| ------------------- | ------ | ------- | ----------------------------------------------------- |
| `sampleSize`        | number | 1000    | Maximum number of records to analyze                  |
| `enumThreshold`     | number | 20      | Fields with ≤ this many unique values become enums    |
| `optionalThreshold` | number | 0.9     | Fields present in < this % of records become optional |

## Input Data Formats

The tool automatically handles various JSON structures:

### Array Format

```json
[
  { "id": 1, "name": "John", "email": "john@example.com" },
  { "id": 2, "name": "Jane", "email": "jane@example.com" }
]
```

### Object with Array Property

```json
{
  "users": [
    { "id": 1, "name": "John" },
    { "id": 2, "name": "Jane" }
  ],
  "meta": { "count": 2 }
}
```

### Single Object

```json
{
  "id": 1,
  "name": "John",
  "profile": {
    "age": 30,
    "city": "New York"
  }
}
```

## Generated Database Structure

The builder creates a complete static file database with the following structure:

```
my-database/
├── schema.ts           # Zod validation schemas
├── types.ts            # TypeScript type definitions
├── client.ts           # Pre-configured, type-safe database client
├── index.ts            # Exports for easy importing
├── metadata.json       # Database metadata and statistics
├── split-metadata.json # Data splitting information
├── build-manifest.json # Build configuration and summary
├── data/               # Record files
│   ├── 000/           # Subdirectory (if enabled)
│   │   ├── batch_0000.json  # Batch files (if batchSize > 1)
│   │   └── 000001.json      # Individual record files
│   └── 001/
└── indexes/            # Query indexes
    ├── _primary.json   # Primary key index
    ├── status.json     # Field-specific indexes
    ├── category.json
    └── userId.json
```

### Schema Files

#### `schema.ts` - Zod Schemas

```typescript
import { z } from 'zod';

const ProfileSchema = z.object({
  age: z.number().int(),
  city: z.string(),
});

export const RecordSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string().email(),
  status: z.enum(['active', 'inactive', 'pending']),
  profile: ProfileSchema.optional(),
});

export type Record = z.infer<typeof RecordSchema>;
```

#### `types.ts` - TypeScript Types

```typescript
// Auto-generated TypeScript types

export interface GeneratedRecord {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'pending';
  profile?: {
    age: number;
    city: string;
  };
}
```

### Database Metadata Files

#### `metadata.json` - Database Information

```json
{
  "totalRecords": 1866,
  "indexes": [
    {
      "field": "status",
      "type": "primitive",
      "uniqueValues": 3,
      "coverage": 1.0
    }
  ],
  "fields": ["id", "name", "status", "profile.age"],
  "createdAt": "2023-06-15T10:00:00Z",
  "version": "1.0.0"
}
```

#### `split-metadata.json` - Data Organization

```json
{
  "totalRecords": 1866,
  "totalFiles": 38,
  "avgFileSize": 1379,
  "primaryKeyField": "id",
  "batchSize": 50,
  "useSubdirectories": true,
  "files": [
    {
      "filename": "000/batch_0000.json",
      "recordCount": 50,
      "size": 65432,
      "recordIds": ["user1", "user2", "..."]
    }
  ]
}
```

### Index Files

#### `indexes/status.json` - Field Index

```json
{
  "field": "status",
  "entries": [
    {
      "value": "active",
      "recordIds": ["user1", "user3", "user5"]
    },
    {
      "value": "inactive",
      "recordIds": ["user2", "user4"]
    }
  ],
  "metadata": {
    "uniqueValues": 2,
    "totalRecords": 1866,
    "coverage": 1.0
  }
}
```

## Type Detection Features

The generator includes intelligent type detection for:

- **Email addresses**: `z.string().email()`
- **URLs**: `z.string().url()`
- **UUIDs**: `z.string().uuid()`
- **ISO dates**: `z.string().datetime()`
- **MongoDB ObjectIds**: `z.string().length(24)`
- **Numeric strings**: `z.string().regex(/^\d+$/)`
- **Integers vs floats**: `z.number().int()` vs `z.number()`

## Advanced Features

### Enum Generation

Fields with limited unique values automatically become enums:

```typescript
// Input data has status: "active", "inactive", "pending"
status: z.enum(['active', 'inactive', 'pending']);
```

### Optional Fields

Fields missing from records become optional:

```typescript
// If 'bio' field is only present in 80% of records
bio: z.string().optional();
```

### Nested Objects

Complex nested structures are handled automatically:

```typescript
const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  country: z.string(),
});

export const RecordSchema = z.object({
  name: z.string(),
  address: AddressSchema,
});
```

### Array Handling

Arrays with mixed types create union schemas:

```typescript
// Array with mixed string/number elements
tags: z.array(z.union([z.string(), z.number()]));
```

## Usage Examples

### Validating Data

```typescript
import { RecordSchema } from './generated';

// Validate single record
const result = RecordSchema.safeParse(jsonData);
if (result.success) {
  console.log('Valid:', result.data);
} else {
  console.log('Invalid:', result.error);
}

// Validate array of records
const records = data.map(item => RecordSchema.parse(item));
```

### With API Responses

```typescript
import { RecordSchema } from './generated';

async function fetchUsers() {
  const response = await fetch('/api/users');
  const data = await response.json();

  // Validate response data
  const users = data.map(user => RecordSchema.parse(user));
  return users;
}
```

## Performance

Real-world performance testing with 1,866 Magic: The Gathering artist records (2MB+ JSON):

- **Build Time**: 1.4 seconds total
- **Schema Generation**: ~400ms
- **Data Splitting**: ~300ms (38 batch files, ~50 records each)
- **Index Generation**: ~600ms (3 indexes: name, date, count)
- **Output Size**: 51.65 MB (optimized for static hosting)
- **Memory Usage**: < 50MB during build process

### Scalability Features

- **Intelligent Indexing**: Automatically skips fields with >10,000 unique values
- **Batch Processing**: Configurable batch sizes for optimal file sizes
- **Subdirectory Organization**: Prevents filesystem limitations with large datasets
- **Incremental Processing**: Memory-efficient streaming for large files

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
pnpm run test

# Run specific test suites
pnpm run test:nested      # Schema generation tests
pnpm run test:builder     # Builder component tests
pnpm run test:integration # Full end-to-end integration test
```

### Test Coverage

- ✅ Schema generation and type introspection
- ✅ Data splitting (individual and batch modes)
- ✅ Index generation for primitive, array, and nested fields
- ✅ Complex nested object handling
- ✅ Array field indexing with contains operator
- ✅ Nested object field querying
- ✅ Runtime query client with caching
- ✅ Individual record retrieval
- ✅ Multi-filter queries with operators (=, !=, >, <, >=, <=, in, contains)
- ✅ Sorting and pagination
- ✅ Database validation and consistency checking
- ✅ Performance optimization and execution timing
- ✅ Metadata generation and integrity
- ✅ File structure validation
- ✅ Real-world dataset processing (1,866 records)

## Development

### Quick Start

**1. Link the package globally:**

```bash
pnpm link --global
```

**2. Link it in the example app:**

```bash
cd example-app
pnpm link --global antipattern-db
pnpm install
```

**3. Start development (2 terminals):**

```bash
# Terminal 1: Watch-build the package
pnpm dev

# Terminal 2: Run example app
cd example-app && pnpm dev
```

That's it! The example app will use your local development version and auto-reload when you make changes.

### Development Commands

```bash
# Build the package once
pnpm build

# Watch-build the main package
pnpm dev

# Run tests
pnpm test
```

### Development Workflow

1. **Make changes** to source files in `src/`
2. **TypeScript automatically rebuilds** the package (via `tsc --watch`)
3. **Example app automatically reloads** with your changes (via Vite HMR)
4. **Test your changes** in the example app at `http://localhost:5173`

### Project Structure

```
antipattern-db/
├── src/                    # Main package source code
│   ├── builder/           # Database building logic
│   ├── runtime/           # Query client runtime
│   ├── cli/              # Command-line interface
│   └── types/            # TypeScript type definitions
├── example-app/           # React example application
│   ├── src/              # Example app source
│   └── package.json      # Uses "file:.." to link to main package
├── tests/                # Test suites
├── dist/                 # Built package output (generated)
└── package.json          # Main package configuration
```

### Testing Changes

The `example-app/` demonstrates real usage of the package. When developing:

1. Make changes to the main package in `src/`
2. The package rebuilds automatically (via `tsc --watch`)
3. The example app automatically reloads with your changes
4. Add new features/examples to the example app as needed

### Adding New Features

1. **Add source code** in the appropriate `src/` subdirectory
2. **Export** new functionality from `src/index.ts`
3. **Add tests** in the `tests/` directory
4. **Update examples** in `example-app/` to demonstrate the feature
5. **Run the full test suite**: `pnpm test`

### Debugging

- **Package build issues**: Check TypeScript errors with `pnpm build`
- **Runtime issues**: Use browser DevTools in the example app
- **Type issues**: Check with `pnpm type-check`
- **Lint issues**: Run `pnpm lint` or `pnpm lint:fix`

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

For development setup, see the [Development](#development) section above.
