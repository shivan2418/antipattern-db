import {
  DataLoader,
  DatabaseRecord,
  DatabaseMetadata,
  SplitMetadata,
  DatabaseIndex,
} from '../core/data-loader.js';

// Declare fetch for browser environments
declare const fetch: typeof globalThis.fetch;

/**
 * Browser implementation of DataLoader using fetch operations
 */
export class BrowserDataLoader implements DataLoader {
  private baseUrl: string;

  constructor(baseUrl: string) {
    // Remove trailing slash for consistency
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async isAvailable(): Promise<boolean> {
    try {
      const [metadataResponse, splitMetadataResponse] = await Promise.all([
        fetch(`${this.baseUrl}/metadata.json`, { method: 'HEAD' }),
        fetch(`${this.baseUrl}/split-metadata.json`, { method: 'HEAD' }),
      ]);
      return metadataResponse.ok && splitMetadataResponse.ok;
    } catch {
      return false;
    }
  }

  async loadMetadata(): Promise<DatabaseMetadata> {
    try {
      const response = await fetch(`${this.baseUrl}/metadata.json`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to load metadata: ${error}`);
    }
  }

  async loadSplitMetadata(): Promise<SplitMetadata> {
    try {
      const response = await fetch(`${this.baseUrl}/split-metadata.json`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to load split metadata: ${error}`);
    }
  }

  async loadSchema(): Promise<any | null> {
    try {
      const response = await fetch(`${this.baseUrl}/schema.json`);

      if (!response.ok) {
        // Schema is optional
        return null;
      }

      return await response.json();
    } catch (error) {
      // Schema loading is optional
      console.warn(`Failed to load schema: ${error}`);
      return null;
    }
  }

  async loadIndex(field: string): Promise<DatabaseIndex | any | null> {
    try {
      const response = await fetch(`${this.baseUrl}/indexes/${field}.json`);

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn(`Failed to load index for field ${field}:`, error);
      return null;
    }
  }

  async loadPrimaryIndex(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/indexes/_primary.json`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Primary index not found`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to load primary index: ${error}`);
    }
  }

  async loadRecord(
    recordId: string,
    fileInfo: SplitMetadata['files'][0],
    splitMetadata: SplitMetadata
  ): Promise<DatabaseRecord | null> {
    try {
      const response = await fetch(`${this.baseUrl}/data/${fileInfo.filename}`);

      if (!response.ok) {
        return null;
      }

      const fileContent = await response.json();

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
