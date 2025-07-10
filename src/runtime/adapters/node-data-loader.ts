import * as fs from 'fs';
import * as path from 'path';
import {
  DataLoader,
  DatabaseRecord,
  DatabaseMetadata,
  SplitMetadata,
  DatabaseIndex,
} from '../core/data-loader.js';

/**
 * Node.js implementation of DataLoader using file system operations
 */
export class NodeDataLoader implements DataLoader {
  constructor(private databaseDir: string) {
    this.databaseDir = path.resolve(databaseDir);
  }

  async isAvailable(): Promise<boolean> {
    try {
      return (
        fs.existsSync(this.databaseDir) &&
        fs.existsSync(path.join(this.databaseDir, 'metadata.json')) &&
        fs.existsSync(path.join(this.databaseDir, 'split-metadata.json'))
      );
    } catch {
      return false;
    }
  }

  async loadMetadata(): Promise<DatabaseMetadata> {
    const metadataPath = path.join(this.databaseDir, 'metadata.json');

    if (!fs.existsSync(metadataPath)) {
      throw new Error('Database metadata file not found');
    }

    try {
      const metadataContent = fs.readFileSync(metadataPath, 'utf8');
      return JSON.parse(metadataContent);
    } catch (error) {
      throw new Error(`Failed to load metadata: ${error}`);
    }
  }

  async loadSplitMetadata(): Promise<SplitMetadata> {
    const splitMetadataPath = path.join(this.databaseDir, 'split-metadata.json');

    if (!fs.existsSync(splitMetadataPath)) {
      throw new Error('Database split metadata file not found');
    }

    try {
      const splitMetadataContent = fs.readFileSync(splitMetadataPath, 'utf8');
      return JSON.parse(splitMetadataContent);
    } catch (error) {
      throw new Error(`Failed to load split metadata: ${error}`);
    }
  }

  async loadSchema(): Promise<any | null> {
    const schemaPath = path.join(this.databaseDir, 'schema.json');

    if (!fs.existsSync(schemaPath)) {
      // Schema is optional
      return null;
    }

    try {
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      return JSON.parse(schemaContent);
    } catch (error) {
      console.warn(`Failed to load schema: ${error}`);
      return null;
    }
  }

  async loadIndex(field: string): Promise<DatabaseIndex | any | null> {
    const indexPath = path.join(this.databaseDir, 'indexes', `${field}.json`);

    if (!fs.existsSync(indexPath)) {
      return null;
    }

    try {
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      return JSON.parse(indexContent);
    } catch (error) {
      throw new Error(`Failed to load index for field ${field}: ${error}`);
    }
  }

  async loadPrimaryIndex(): Promise<any> {
    const indexPath = path.join(this.databaseDir, 'indexes', '_primary.json');

    if (!fs.existsSync(indexPath)) {
      throw new Error('Primary index not found');
    }

    try {
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      return JSON.parse(indexContent);
    } catch (error) {
      throw new Error(`Failed to load primary index: ${error}`);
    }
  }

  async loadRecord(
    recordId: string,
    fileInfo: SplitMetadata['files'][0],
    splitMetadata: SplitMetadata
  ): Promise<DatabaseRecord | null> {
    const filePath = path.join(this.databaseDir, 'data', fileInfo.filename);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (splitMetadata.batchSize > 1) {
        // Batch file - find the specific record
        const record = Array.isArray(fileContent)
          ? fileContent.find(r => r[splitMetadata.primaryKeyField] === recordId)
          : null;
        return record || null;
      } else {
        // Individual record file
        if (fileContent[splitMetadata.primaryKeyField] === recordId) {
          return fileContent;
        }
      }
    } catch (error) {
      console.error(`Failed to load record ${recordId}:`, error);
    }

    return null;
  }
}
