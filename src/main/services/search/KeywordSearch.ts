import { Document } from 'flexsearch';
import { INDEX_PATH } from '../../utils/paths';
import fs from 'fs';
import path from 'path';

export class KeywordSearch {
  private static instance: KeywordSearch;
  private index: any; // FlexSearch types are tricky, using any for now or I need to import specific types
  
  private constructor() {
    this.index = new Document({
      document: {
        id: 'id',
        index: ['content', 'filename'],
        store: ['content', 'filename', 'source'],
      },
      tokenize: 'forward', // good for partial matches
      charset: 'latin:extra', // or implement a custom tokenizer for Chinese?
      // For Chinese, we might need a better tokenizer or use 'sylvanas' if available, or just split by characters.
      // Flexsearch has 'cjk' encode since some version.
      encode: 'icase', 
    });
    // Chinese support in FlexSearch is limited out of the box without plugins.
    // 'encode: false' + custom split?
    // Let's stick to default for now, maybe add 'encode: "balance"'
  }

  public static getInstance(): KeywordSearch {
    if (!KeywordSearch.instance) {
      KeywordSearch.instance = new KeywordSearch();
    }
    return KeywordSearch.instance;
  }

  public async initialize() {
    if (!fs.existsSync(INDEX_PATH)) {
      fs.mkdirSync(INDEX_PATH, { recursive: true });
    }
    await this.loadIndex();
  }

  public async addDocuments(docs: any[]) {
    for (const doc of docs) {
      this.index.add(doc);
    }
    await this.saveIndex();
  }

  public async search(query: string, limit = 50) {
    const results = await this.index.search(query, {
      limit,
      enrich: true, // Get stored content
    });
    
    // Flatten results
    // FlexSearch returns [{ field: 'content', result: [...] }, { field: 'filename', result: [...] }]
    // We need to merge them.
    const uniqueDocs = new Map();
    
    results.forEach((fieldResult: any) => {
      fieldResult.result.forEach((r: any) => {
        if (!uniqueDocs.has(r.id)) {
          uniqueDocs.set(r.id, {
            id: r.id,
            ...r.doc,
            score: 0, // Flexsearch doesn't give score easily in 'enrich' mode without simple search?
            // Actually it does not return score in document search easily?
            // Wait, standard flexsearch usage returns IDs.
          });
        }
      });
    });

    return Array.from(uniqueDocs.values());
  }

  private async saveIndex() {
    // FlexSearch export is a bit complex for Document. 
    // We need to export each key.
    // For simplicity in this demo, we might skip full persistence implementation 
    // or just export keys to JSON files.
    
    // This is a placeholder for persistence. 
    // Real implementation requires iterating keys and writing files.
    /*
    const keys = await this.index.export(); 
    // Write keys to disk
    */
  }

  private async loadIndex() {
    // Load from disk
  }
}
