import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';

export class IngestionService {
  private static instance: IngestionService;

  private constructor() {}

  public static getInstance(): IngestionService {
    if (!IngestionService.instance) {
      IngestionService.instance = new IngestionService();
    }
    return IngestionService.instance;
  }

  public async loadFile(filePath: string): Promise<Document[]> {
    let loader;
    if (filePath.endsWith('.pdf')) {
      loader = new PDFLoader(filePath, {
        splitPages: false, // Combine pages or keep separate? Usually separate is better for granular chunks, but let's see. 
        // Langchain default is one doc per page.
      });
    } else if (filePath.endsWith('.docx')) {
      loader = new DocxLoader(filePath);
    } else {
      throw new Error('Unsupported file type');
    }

    const docs = await loader.load();
    return docs;
  }

  public async splitDocuments(docs: Document[]): Promise<Document[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });

    const splitDocs = await splitter.splitDocuments(docs);
    return splitDocs;
  }

  public async processFile(filePath: string) {
    const docs = await this.loadFile(filePath);
    const chunks = await this.splitDocuments(docs);
    // Add metadata
    chunks.forEach(chunk => {
        chunk.metadata.source = filePath;
        chunk.metadata.filename = filePath.split('/').pop();
    });
    return chunks;
  }
}
