import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { Document } from '@langchain/core/documents'
import { SPLITTER_BIG_CHUNK_SETTING, SPLITTER_MINI_CHUNK_SIZE } from '../../utils/constant'

export class IngestionService {
  private static instance: IngestionService

  private constructor() {}

  public static getInstance(): IngestionService {
    if (!IngestionService.instance) {
      IngestionService.instance = new IngestionService()
    }
    return IngestionService.instance
  }

  public async loadFile(filePath: string): Promise<Document[]> {
    let loader
    if (filePath.endsWith('.pdf')) {
      loader = new PDFLoader(filePath)
    } else if (filePath.endsWith('.docx')) {
      loader = new DocxLoader(filePath)
    } else {
      throw new Error('Unsupported file type')
    }

    const docs = await loader.load()
    return docs
  }

  public async splitDocuments(docs: Document[]): Promise<{
    bigSplitDocs: Document[]
    miniSplitDocs: Document[]
  }> {
    const bigSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: SPLITTER_BIG_CHUNK_SETTING.chunkSize,
      chunkOverlap: SPLITTER_BIG_CHUNK_SETTING.chunkOverlap
    })

    const miniSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: SPLITTER_MINI_CHUNK_SIZE.chunkSize,
      chunkOverlap: SPLITTER_MINI_CHUNK_SIZE.chunkOverlap
    })

    const bigSplitDocs = await bigSplitter.splitDocuments(docs)
    const miniSplitDocs = await miniSplitter.splitDocuments(docs)
    return {
      bigSplitDocs,
      miniSplitDocs
    }
  }

  public async processFile(filePath: string) {
    const docs = await this.loadFile(filePath)
    const { bigSplitDocs, miniSplitDocs } = await this.splitDocuments(docs)

    return {
      bigSplitDocs,
      miniSplitDocs
    }
  }
}
