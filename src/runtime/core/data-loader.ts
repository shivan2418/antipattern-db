export interface DatabaseRecord {
  [key: string]: any;
}

export interface DatabaseIndex {
  field: string;
  entries: Array<{
    value: any;
    recordIds: string[];
  }>;
  metadata: {
    uniqueValues: number;
    totalRecords: number;
    coverage: number;
  };
}

export interface DatabaseMetadata {
  totalRecords: number;
  indexes: Array<{
    field: string;
    type: 'primitive' | 'array' | 'nested';
    uniqueValues: number;
    coverage: number;
  }>;
  fields: string[];
  createdAt: string;
  version: string;
}

export interface SplitMetadata {
  totalRecords: number;
  totalFiles: number;
  avgFileSize: number;
  primaryKeyField: string;
  batchSize: number;
  useSubdirectories: boolean;
  files: Array<{
    filename: string;
    recordCount: number;
    size: number;
    recordIds: string[];
    subdirectory?: string;
  }>;
}

/**
 * Abstract interface for loading data from different environments
 * Implementations handle the specific I/O operations for Node.js vs Browser
 */
export interface DataLoader {
  /**
   * Load database metadata
   */
  loadMetadata(): Promise<DatabaseMetadata>;

  /**
   * Load split metadata (file organization info)
   */
  loadSplitMetadata(): Promise<SplitMetadata>;

  /**
   * Load schema file (optional, may return null)
   */
  loadSchema(): Promise<any | null>;

  /**
   * Load an index file for a specific field
   * @param field The field name
   * @returns Index data or null if not found
   */
  loadIndex(field: string): Promise<DatabaseIndex | any | null>;

  /**
   * Load the primary index
   */
  loadPrimaryIndex(): Promise<any>;

  /**
   * Load a specific record by ID
   * @param recordId The record ID
   * @param fileInfo File information from split metadata
   * @param splitMetadata Split metadata for batch info
   */
  loadRecord(
    recordId: string,
    fileInfo: SplitMetadata['files'][0],
    splitMetadata: SplitMetadata
  ): Promise<DatabaseRecord | null>;

  /**
   * Check if the data source is available/initialized
   */
  isAvailable(): Promise<boolean>;
}
