import * as lancedb from '@lancedb/lancedb';
import { DB_PATH } from '../../utils/paths';
import fs from 'fs';

export class VectorStore {
  private static instance: VectorStore;
  private db: lancedb.Connection | null = null;
  private tableName = 'documents';

  private constructor() {}

  public static getInstance(): VectorStore {
    if (!VectorStore.instance) {
      VectorStore.instance = new VectorStore();
    }
    return VectorStore.instance;
  }

  public async initialize() {
    if (!fs.existsSync(DB_PATH)) {
      fs.mkdirSync(DB_PATH, { recursive: true });
    }
    this.db = await lancedb.connect(DB_PATH);
  }

  public async addDocuments(vectors: number[][], metadatas: any[], ids: string[]) {
    if (!this.db) await this.initialize();

    const data = vectors.map((vector, i) => ({
      vector,
      ...metadatas[i],
      id: ids[i],
    }));

    // Check if table exists, if not create it
    const tableNames = await this.db!.tableNames();
    let table;
    if (tableNames.includes(this.tableName)) {
      table = await this.db!.openTable(this.tableName);
      await table.add(data);
    } else {
      // Create table with the first item to define schema (lancedb infers schema)
      // Note: In a real app, defining schema explicitly is better.
      table = await this.db!.createTable(this.tableName, data);
    }
  }

  public async search(queryVector: number[], limit = 50) {
    if (!this.db) await this.initialize();
    
    const tableNames = await this.db!.tableNames();
    if (!tableNames.includes(this.tableName)) return [];

    const table = await this.db!.openTable(this.tableName);
    const results = await table.vectorSearch(queryVector)
      .limit(limit)
      .toArray();
    
    return results;
  }
}
