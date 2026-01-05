import type { ElectronAPI } from '@electron-toolkit/preload'

export interface RendererSearchResult {
  id: string
  filename: string
  text: string
  createdAt?: number
  _score?: number
  _relevance_score?: number
  _distance?: number
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ingestFile: (file: File) => Promise<{ success: boolean; count?: number; error?: string }>
      search: (query: string) => Promise<RendererSearchResult[]>
      ftsSearch: (query: string) => Promise<RendererSearchResult[]>
      vectorSearch: (query: string) => Promise<RendererSearchResult[]>
      hybridSearch: (query: string) => Promise<RendererSearchResult[]>
    }
  }
}
