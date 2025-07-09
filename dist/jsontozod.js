import * as fs from 'fs';
import * as path from 'path';
class JSONToZodGenerator {
    constructor(options = {}) {
        this.sampleSize = options.sampleSize || 1000;
        this.enumThreshold = options.enumThreshold || 20; // If field has ≤20 unique values, make it enum
        this.optionalThreshold = options.optionalThreshold || 0.5; // If field present in <50% of records, make optional
        this.fieldStats = new Map();
        this.totalRecords = 0;
    }
    async generateFromFile(inputPath, outputDir = './generated') {
        console.log(`🔍 Analyzing ${inputPath}...`);
        // Read and analyze JSON
        const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
        const records = this.extractRecords(data);
        console.log(`📊 Found ${records.length} records`);
        // Analyze sample
        const sample = records.slice(0, Math.min(this.sampleSize, records.length));
        this.totalRecords = records.length;
        sample.forEach(record => {
            this.analyzeRecord(record, '');
        });
        // Generate schemas
        const schema = this.generateZodSchema();
        const types = this.generateTypeScript();
        // Write files
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(path.join(outputDir, 'schema.ts'), schema);
        fs.writeFileSync(path.join(outputDir, 'types.ts'), types);
        fs.writeFileSync(path.join(outputDir, 'index.ts'), this.generateIndexFile());
        console.log(`✅ Generated schemas in ${outputDir}/`);
        console.log(`   - schema.ts (Zod schemas)`);
        console.log(`   - types.ts (TypeScript types)`);
        console.log(`   - index.ts (exports)`);
        return {
            schema,
            types,
            stats: this.getFieldStats(),
        };
    }
    extractRecords(data) {
        if (Array.isArray(data)) {
            return data;
        }
        else if (typeof data === 'object' && data !== null) {
            // Find the largest array property
            const dataObj = data;
            const arrayProps = Object.keys(dataObj).filter(key => Array.isArray(dataObj[key]));
            if (arrayProps.length > 0) {
                const largest = arrayProps.reduce((max, prop) => dataObj[prop].length > dataObj[max].length ? prop : max);
                console.log(`📋 Using collection: ${largest} (${dataObj[largest].length} records)`);
                return dataObj[largest];
            }
            return [data];
        }
        return [];
    }
    analyzeRecord(record, prefix) {
        if (typeof record !== 'object' || record === null)
            return;
        const recordObj = record;
        Object.keys(recordObj).forEach(key => {
            const fieldPath = prefix ? `${prefix}.${key}` : key;
            const value = recordObj[key];
            if (!this.fieldStats.has(fieldPath)) {
                this.fieldStats.set(fieldPath, {
                    count: 0,
                    nullCount: 0,
                    types: new Map(),
                    uniqueValues: new Set(),
                    samples: [],
                    isArray: false,
                    arrayElementTypes: new Set(),
                    nestedFields: new Map(),
                });
            }
            const stats = this.fieldStats.get(fieldPath);
            stats.count++;
            if (value === null || value === undefined) {
                stats.nullCount++;
                return;
            }
            const detailedType = this.getDetailedType(value);
            stats.types.set(detailedType, (stats.types.get(detailedType) || 0) + 1);
            // Store samples
            if (stats.samples.length < 10) {
                stats.samples.push(value);
            }
            // Track unique values for enum detection
            if (this.isPrimitive(value) && stats.uniqueValues.size < this.enumThreshold + 1) {
                stats.uniqueValues.add(value);
            }
            // Handle arrays
            if (Array.isArray(value)) {
                stats.isArray = true;
                value.forEach(item => {
                    if (item !== null && item !== undefined) {
                        stats.arrayElementTypes.add(this.getDetailedType(item));
                        // Recursively analyze array elements that are objects
                        // Use a generic path without the index to group all similar objects
                        if (typeof item === 'object' && !Array.isArray(item)) {
                            this.analyzeRecord(item, `${fieldPath}[]`);
                        }
                    }
                });
            }
            // Handle nested objects
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                this.analyzeRecord(value, fieldPath);
            }
        });
    }
    getDetailedType(value) {
        if (value === null)
            return 'null';
        if (Array.isArray(value))
            return 'array';
        if (value instanceof Date)
            return 'date';
        if (typeof value === 'string') {
            // Pattern detection
            if (this.isISO8601Date(value))
                return 'date-string';
            if (this.isEmail(value))
                return 'email';
            if (this.isUrl(value))
                return 'url';
            if (this.isUuid(value))
                return 'uuid';
            if (this.isObjectId(value))
                return 'objectid';
            if (/^\d+$/.test(value))
                return 'numeric-string';
            return 'string';
        }
        if (typeof value === 'number') {
            return Number.isInteger(value) ? 'integer' : 'number';
        }
        if (typeof value === 'object' && value !== null) {
            return 'object';
        }
        return typeof value;
    }
    isISO8601Date(str) {
        return (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(str) ||
            /^\d{4}-\d{2}-\d{2}$/.test(str));
    }
    isEmail(str) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
    }
    isUrl(str) {
        return /^https?:\/\//.test(str);
    }
    isUuid(str) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    }
    isObjectId(str) {
        return /^[a-f\d]{24}$/i.test(str);
    }
    isPrimitive(value) {
        return ['string', 'number', 'boolean'].includes(typeof value);
    }
    generateZodSchema() {
        // const imports = new Set(['z']); // Will be used for future imports
        let schema = `import { z } from 'zod';\n\n`;
        // Generate nested schemas first
        const nestedSchemas = this.generateNestedSchemas();
        schema += nestedSchemas.schemas;
        // Generate main schema
        schema += `export const RecordSchema = z.object({\n`;
        const rootFields = Array.from(this.fieldStats.keys()).filter(key => !key.includes('.'));
        rootFields.forEach(fieldPath => {
            const stats = this.fieldStats.get(fieldPath);
            const fieldSchema = this.generateFieldSchema(fieldPath, stats);
            schema += `  ${this.sanitizeFieldName(fieldPath)}: ${fieldSchema},\n`;
        });
        schema += `});\n\n`;
        schema += `export type Record = z.infer<typeof RecordSchema>;\n`;
        return schema;
    }
    generateNestedSchemas() {
        const schemas = [];
        const schemaNames = new Map();
        // Find all nested object paths
        const nestedPaths = Array.from(this.fieldStats.keys())
            .filter(key => key.includes('.'))
            .map(key => {
            const parts = key.split('.');
            // Handle array notation - remove the field name to get the container path
            return parts.slice(0, -1).join('.');
        })
            .filter((path, index, arr) => arr.indexOf(path) === index)
            .sort((a, b) => b.split('.').length - a.split('.').length); // Deepest first
        nestedPaths.forEach(path => {
            const schemaName = this.pathToSchemaName(path);
            schemaNames.set(path, schemaName);
            const fields = Array.from(this.fieldStats.keys()).filter(key => key.startsWith(`${path}.`) && !key.slice(path.length + 1).includes('.'));
            if (fields.length > 0) {
                schemas.push(`const ${schemaName} = z.object({`);
                fields.forEach(fieldPath => {
                    const fieldName = fieldPath.split('.').pop();
                    const stats = this.fieldStats.get(fieldPath);
                    const fieldSchema = this.generateFieldSchema(fieldPath, stats, schemaNames);
                    schemas.push(`  ${this.sanitizeFieldName(fieldName)}: ${fieldSchema},`);
                });
                schemas.push(`});\n`);
            }
        });
        return {
            schemas: schemas.length > 0 ? `${schemas.join('\n')}\n` : '',
            schemaNames,
        };
    }
    generateFieldSchema(fieldPath, stats, schemaNames) {
        const isOptional = stats.count / this.totalRecords < this.optionalThreshold;
        const isNullable = stats.nullCount > 0;
        // Get most common type
        const typeEntries = Array.from(stats.types.entries()).sort((a, b) => b[1] - a[1]);
        const primaryType = typeEntries[0]?.[0];
        let zodType = '';
        if (stats.isArray) {
            zodType = this.generateArraySchema(stats, schemaNames, fieldPath);
        }
        else if (this.shouldBeEnum(stats)) {
            zodType = this.generateEnumSchema(stats);
        }
        else if (this.isBooleanUnion(stats)) {
            zodType = 'z.boolean()';
        }
        else if (primaryType === 'object' || this.hasNestedFields(fieldPath)) {
            // Handle nested objects
            if (schemaNames && schemaNames.has(fieldPath)) {
                zodType = schemaNames.get(fieldPath);
            }
            else if (this.hasNestedFields(fieldPath)) {
                // If we have nested fields but no schema name yet, generate the schema name
                const schemaName = this.pathToSchemaName(fieldPath);
                zodType = schemaName;
            }
            else {
                // For objects without nested schema, use z.record() for dynamic properties
                zodType = 'z.record(z.unknown())';
            }
        }
        else {
            zodType = this.generatePrimitiveSchema(primaryType, stats);
        }
        // Handle multiple types (union) - but not for objects
        if (stats.types.size > 1 && !stats.isArray && primaryType !== 'object') {
            const unionTypes = Array.from(stats.types.keys())
                .filter(type => type !== 'null' && type !== 'object')
                .map(type => this.generatePrimitiveSchema(type, stats));
            if (unionTypes.length > 1) {
                zodType = `z.union([${unionTypes.join(', ')}])`;
            }
        }
        // Add modifiers
        if (isNullable && !isOptional) {
            zodType += '.nullable()';
        }
        if (isOptional) {
            zodType += '.optional()';
        }
        return zodType;
    }
    generateArraySchema(stats, schemaNames, fieldPath) {
        if (stats.arrayElementTypes.size === 1) {
            const elementType = Array.from(stats.arrayElementTypes)[0];
            if (elementType === 'object') {
                // Check if we have a schema for array elements
                const arrayElementPath = fieldPath ? `${fieldPath}[]` : '';
                if (schemaNames && schemaNames.has(arrayElementPath)) {
                    return `z.array(${schemaNames.get(arrayElementPath)})`;
                }
                // If no specific schema, but we know there are nested fields, try to find a matching schema
                if (fieldPath && this.hasNestedFields(arrayElementPath)) {
                    const schemaName = this.pathToSchemaName(arrayElementPath);
                    return `z.array(${schemaName})`;
                }
                return 'z.array(z.record(z.unknown()))';
            }
            const elementSchema = this.generatePrimitiveSchema(elementType);
            return `z.array(${elementSchema})`;
        }
        else if (stats.arrayElementTypes.size > 1) {
            const unionTypes = Array.from(stats.arrayElementTypes).map(type => {
                if (type === 'object') {
                    const arrayElementPath = fieldPath ? `${fieldPath}[]` : '';
                    if (schemaNames && schemaNames.has(arrayElementPath)) {
                        return schemaNames.get(arrayElementPath);
                    }
                    if (fieldPath && this.hasNestedFields(arrayElementPath)) {
                        return this.pathToSchemaName(arrayElementPath);
                    }
                    return 'z.record(z.unknown())';
                }
                return this.generatePrimitiveSchema(type);
            });
            return `z.array(z.union([${unionTypes.join(', ')}]))`;
        }
        return 'z.array(z.unknown())';
    }
    generateEnumSchema(stats) {
        const values = Array.from(stats.uniqueValues);
        const enumValues = values.map(v => (typeof v === 'string' ? `'${v}'` : v)).join(', ');
        return `z.enum([${enumValues}])`;
    }
    generatePrimitiveSchema(type, _stats = null) {
        switch (type) {
            case 'string':
                return 'z.string()';
            case 'email':
                return 'z.string().email()';
            case 'url':
                return 'z.string().url()';
            case 'uuid':
                return 'z.string().uuid()';
            case 'date-string':
                return 'z.string().datetime()';
            case 'numeric-string':
                return 'z.string().regex(/^\\d+$/)';
            case 'integer':
                return 'z.number().int()';
            case 'number':
                return 'z.number()';
            case 'boolean':
                return 'z.boolean()';
            case 'date':
                return 'z.date()';
            case 'objectid':
                return 'z.string().length(24)';
            case 'object':
                return 'z.record(z.unknown())';
            default:
                return 'z.unknown()';
        }
    }
    shouldBeEnum(stats) {
        // Don't create enums for boolean values
        const values = Array.from(stats.uniqueValues);
        const hasOnlyBooleans = values.every(v => typeof v === 'boolean');
        if (hasOnlyBooleans) {
            return false;
        }
        return (stats.uniqueValues.size <= this.enumThreshold &&
            stats.uniqueValues.size > 1 &&
            stats.uniqueValues.size < stats.count * 0.8);
    }
    hasNestedFields(fieldPath) {
        return Array.from(this.fieldStats.keys()).some(key => key.startsWith(`${fieldPath}.`) && key !== fieldPath);
    }
    isBooleanUnion(stats) {
        const values = Array.from(stats.uniqueValues);
        return values.length === 2 && values.every(v => typeof v === 'boolean');
    }
    pathToSchemaName(path) {
        return `${path
            .split('.')
            .map(part => {
            // Handle array notation by removing brackets
            const cleanPart = part.replace(/\[\]/g, 'Item');
            return cleanPart.charAt(0).toUpperCase() + cleanPart.slice(1);
        })
            .join('')}Schema`;
    }
    pathToTypeName(path) {
        return path
            .split('.')
            .map(part => {
            // Handle array notation by removing brackets
            const cleanPart = part.replace(/\[\]/g, 'Item');
            return cleanPart.charAt(0).toUpperCase() + cleanPart.slice(1);
        })
            .join('');
    }
    sanitizeFieldName(name) {
        // Handle field names that aren't valid JS identifiers
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
            return name;
        }
        return `'${name}'`;
    }
    generateTypeScript() {
        let types = `// Auto-generated TypeScript types\n\n`;
        // Generate nested interface types first
        const nestedTypes = this.generateNestedTypes();
        types += nestedTypes;
        types += `export interface GeneratedRecord {\n`;
        const rootFields = Array.from(this.fieldStats.keys()).filter(key => !key.includes('.'));
        rootFields.forEach(fieldPath => {
            const stats = this.fieldStats.get(fieldPath);
            const tsType = this.generateTSType(fieldPath, stats);
            const isOptional = stats.count / this.totalRecords < this.optionalThreshold;
            const optionalMarker = isOptional ? '?' : '';
            types += `  ${this.sanitizeFieldName(fieldPath)}${optionalMarker}: ${tsType};\n`;
        });
        types += `}\n\n`;
        // Generate enum types
        const enumTypes = this.generateEnumTypes();
        types += enumTypes;
        return types;
    }
    generateNestedTypes() {
        let types = '';
        // Find all nested object paths
        const nestedPaths = Array.from(this.fieldStats.keys())
            .filter(key => key.includes('.'))
            .map(key => {
            const parts = key.split('.');
            return parts.slice(0, -1).join('.');
        })
            .filter((path, index, arr) => arr.indexOf(path) === index)
            .sort((a, b) => b.split('.').length - a.split('.').length); // Deepest first
        nestedPaths.forEach(path => {
            const typeName = this.pathToTypeName(path);
            const fields = Array.from(this.fieldStats.keys()).filter(key => key.startsWith(`${path}.`) && !key.slice(path.length + 1).includes('.'));
            if (fields.length > 0) {
                types += `export interface ${typeName} {\n`;
                fields.forEach(fieldPath => {
                    const fieldName = fieldPath.split('.').pop();
                    const stats = this.fieldStats.get(fieldPath);
                    const tsType = this.generateTSType(fieldPath, stats);
                    const isOptional = stats.count / this.totalRecords < this.optionalThreshold;
                    const optionalMarker = isOptional ? '?' : '';
                    types += `  ${this.sanitizeFieldName(fieldName)}${optionalMarker}: ${tsType};\n`;
                });
                types += `}\n\n`;
            }
        });
        return types;
    }
    generateTSType(fieldPath, stats) {
        const isNullable = stats.nullCount > 0;
        if (stats.isArray) {
            if (stats.arrayElementTypes.size === 1) {
                const elementType = Array.from(stats.arrayElementTypes)[0];
                if (elementType === 'object') {
                    // Check if we have a specific type for array elements
                    const arrayElementPath = `${fieldPath}[]`;
                    if (this.hasNestedFields(arrayElementPath)) {
                        const typeName = this.pathToTypeName(arrayElementPath);
                        return `${typeName}[]`;
                    }
                    return 'Record<string, unknown>[]';
                }
                return `${this.primitiveToTSType(elementType)}[]`;
            }
            else {
                const unionTypes = Array.from(stats.arrayElementTypes).map(type => {
                    if (type === 'object') {
                        const arrayElementPath = `${fieldPath}[]`;
                        if (this.hasNestedFields(arrayElementPath)) {
                            return this.pathToTypeName(arrayElementPath);
                        }
                        return 'Record<string, unknown>';
                    }
                    return this.primitiveToTSType(type);
                });
                return `(${unionTypes.join(' | ')})[]`;
            }
        }
        if (this.shouldBeEnum(stats)) {
            const values = Array.from(stats.uniqueValues);
            const unionType = values.map(v => (typeof v === 'string' ? `'${v}'` : v)).join(' | ');
            return isNullable ? `${unionType} | null` : unionType;
        }
        // Handle object types
        const primaryType = Array.from(stats.types.keys())[0];
        if (primaryType === 'object' || this.hasNestedFields(fieldPath)) {
            if (this.hasNestedFields(fieldPath)) {
                // Use the generated type name for nested objects
                const typeName = this.pathToTypeName(fieldPath);
                const baseType = typeName;
                return isNullable ? `${baseType} | null` : baseType;
            }
            else {
                const baseType = 'Record<string, unknown>';
                return isNullable ? `${baseType} | null` : baseType;
            }
        }
        if (stats.types.size > 1) {
            const unionTypes = Array.from(stats.types.keys())
                .filter(type => type !== 'null')
                .map(type => this.primitiveToTSType(type));
            const baseType = unionTypes.join(' | ');
            return isNullable ? `${baseType} | null` : baseType;
        }
        const baseType = this.primitiveToTSType(primaryType);
        return isNullable ? `${baseType} | null` : baseType;
    }
    primitiveToTSType(type) {
        switch (type) {
            case 'string':
            case 'email':
            case 'url':
            case 'uuid':
            case 'date-string':
            case 'numeric-string':
            case 'objectid':
                return 'string';
            case 'integer':
            case 'number':
                return 'number';
            case 'boolean':
                return 'boolean';
            case 'date':
                return 'Date';
            case 'object':
                return 'Record<string, unknown>';
            default:
                return 'unknown';
        }
    }
    generateEnumTypes() {
        let enums = '';
        Array.from(this.fieldStats.entries()).forEach(([fieldPath, stats]) => {
            if (this.shouldBeEnum(stats) && !fieldPath.includes('.')) {
                const enumName = `${fieldPath.charAt(0).toUpperCase() + fieldPath.slice(1)}Enum`;
                const values = Array.from(stats.uniqueValues);
                enums += `export enum ${enumName} {\n`;
                values.forEach(value => {
                    const key = typeof value === 'string'
                        ? value.toUpperCase().replace(/[^A-Z0-9]/g, '_')
                        : `VALUE_${value}`;
                    const val = typeof value === 'string' ? `'${value}'` : value;
                    enums += `  ${key} = ${val},\n`;
                });
                enums += `}\n\n`;
            }
        });
        return enums;
    }
    generateIndexFile() {
        return `// Auto-generated exports
export { RecordSchema } from './schema';
export type { Record } from './schema';
export type { GeneratedRecord } from './types';
`;
    }
    getFieldStats() {
        const stats = {};
        this.fieldStats.forEach((value, key) => {
            stats[key] = {
                coverage: (value.count / this.totalRecords) * 100,
                types: Array.from(value.types.keys()),
                uniqueValues: value.uniqueValues.size,
                samples: value.samples.slice(0, 3),
            };
        });
        return stats;
    }
}
// CLI usage
async function main() {
    const generator = new JSONToZodGenerator();
    const inputFile = process.argv[2];
    const outputDir = process.argv[3] || './generated';
    if (!inputFile) {
        console.log('Usage: node json-to-zod.js <input.json> [output-dir]');
        process.exit(1);
    }
    try {
        await generator.generateFromFile(inputFile, outputDir);
        console.log('✅ Schema generation complete!');
    }
    catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}
// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
export default JSONToZodGenerator;
