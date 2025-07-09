# JSON to Zod Schema Generator

A powerful TypeScript tool that analyzes JSON data and automatically generates Zod schemas and TypeScript types. Perfect for creating type-safe validation schemas from existing JSON datasets.

## Features

- 🔍 **Smart Analysis**: Analyzes JSON structure and infers optimal Zod schemas
- 📊 **Statistical Insights**: Provides coverage statistics and type distribution
- 🎯 **Enum Detection**: Automatically detects and creates enums for fields with limited unique values
- 📦 **Multiple Output Formats**: Generates Zod schemas, TypeScript types, and enum definitions
- 🔧 **Configurable**: Customizable thresholds for optional fields and enum detection
- 📁 **Flexible Input**: Handles arrays, nested objects, and complex JSON structures

## Installation

```bash
# Install dependencies
pnpm install

# tsx is already included as a dev dependency
```

## Usage

### Command Line Interface

```bash
# Run directly with tsx (recommended)
npx tsx jsontozod.ts <input.json> [output-dir]

# Using npm script
pnpm run jsontozod <input.json> [output-dir]

# Or compile and run with Node.js
npx tsc jsontozod.ts
node jsontozod.js <input.json> [output-dir]

# Examples
npx tsx jsontozod.ts data/users.json ./generated
pnpm run jsontozod data/products.json ./schemas
```

### Programmatic Usage

```typescript
import JSONToZodGenerator from './jsontozod';

const generator = new JSONToZodGenerator({
  sampleSize: 1000, // Number of records to analyze
  enumThreshold: 20, // Max unique values to create enum
  optionalThreshold: 0.9, // Threshold for optional fields
});

const result = await generator.generateFromFile('./data.json', './output');
console.log(result.stats);
```

## Configuration Options

### Constructor Options

| Option              | Type   | Default | Description                                           |
| ------------------- | ------ | ------- | ----------------------------------------------------- |
| `sampleSize`        | number | 1000    | Maximum number of records to analyze                  |
| `enumThreshold`     | number | 20      | Fields with ≤ this many unique values become enums    |
| `optionalThreshold` | number | 0.9     | Fields present in < this % of records become optional |

### Example Configuration

```typescript
const generator = new JSONToZodGenerator({
  sampleSize: 5000, // Analyze up to 5000 records
  enumThreshold: 10, // Create enums for fields with ≤10 unique values
  optionalThreshold: 0.95, // Make fields optional if present in <95% of records
});
```

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

## Generated Output Files

### `schema.ts` - Zod Schemas

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

### `types.ts` - TypeScript Types

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

export enum StatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}
```

### `index.ts` - Exports

```typescript
// Auto-generated exports
export { RecordSchema } from './schema';
export type { Record } from './schema';
export type { GeneratedRecord } from './types';
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

## Statistics and Analysis

The generator provides detailed statistics about your data:

```typescript
const result = await generator.generateFromFile('./data.json');
console.log(result.stats);
// Output:
// {
//   "id": {
//     "coverage": 100,
//     "types": ["integer"],
//     "uniqueValues": 1000,
//     "samples": [1, 2, 3]
//   },
//   "email": {
//     "coverage": 95,
//     "types": ["email"],
//     "uniqueValues": 950,
//     "samples": ["john@example.com", "jane@example.com"]
//   }
// }
```

## Error Handling

The tool includes comprehensive error handling:

```bash
# Missing input file
❌ Error: ENOENT: no such file or directory

# Invalid JSON
❌ Error: Unexpected token in JSON at position 0

# Permission errors
❌ Error: EACCES: permission denied
```

## Best Practices

1. **Sample Size**: Use appropriate sample sizes for large datasets
2. **Thresholds**: Adjust thresholds based on your data characteristics
3. **Validation**: Always validate the generated schemas with your actual data
4. **Updates**: Regenerate schemas when your data structure changes

## Contributing

This tool is part of the antipattern-db project. Feel free to submit issues and improvements!

## License

MIT License - see LICENSE file for details.
