import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  SearchResult,
  DocumentListResponse,
  ChunkListResponse,
  SearchSourceFilter,
  WebIngestPayload
} from '../shared/types'

// Custom APIs for renderer
const api = {
  ingestFile: (file: File): Promise<{ success: boolean; count?: number; error?: string }> =>
    ipcRenderer.invoke('ingest-file', webUtils.getPathForFile(file), file.name),
  ingestFiles: (files: File[]): Promise<{ success: boolean; created?: number; error?: string }> =>
    ipcRenderer.invoke(
      'ingest-files',
      files.map((f) => ({ path: webUtils.getPathForFile(f), name: f.name }))
    ),
  ingestWeb: (
    payload: WebIngestPayload
  ): Promise<{ success: boolean; count?: number; error?: string }> =>
    ipcRenderer.invoke('ingest-web', payload),
  ingestWebs: (
    payload: WebIngestPayload[]
  ): Promise<{ success: boolean; created?: number; error?: string }> =>
    ipcRenderer.invoke('ingest-webs', payload),
  openExternal: (url: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('open-external', url),
  search: (
    query: string,
    sourceType?: SearchSourceFilter
  ): Promise<{ results: SearchResult[]; tokens: string[] }> =>
    ipcRenderer.invoke('search', query, sourceType),
  ftsSearch: (query: string, sourceType?: SearchSourceFilter): Promise<SearchResult[]> =>
    ipcRenderer.invoke('fts-search', query, sourceType),
  vectorSearch: (query: string, sourceType?: SearchSourceFilter): Promise<SearchResult[]> =>
    ipcRenderer.invoke('vector-search', query, sourceType),
  hybridSearch: (query: string, sourceType?: SearchSourceFilter): Promise<SearchResult[]> =>
    ipcRenderer.invoke('hybrid-search', query, sourceType),
  listDocuments: (payload: {
    keyword?: string
    page: number
    pageSize: number
  }): Promise<DocumentListResponse> => ipcRenderer.invoke('list-documents', payload),
  listChunks: (payload: {
    keyword?: string
    page: number
    pageSize: number
  }): Promise<ChunkListResponse> => ipcRenderer.invoke('list-chunks', payload),
  deleteDocuments: (
    ids: string[]
  ): Promise<{ success: boolean; deletedDocs?: number; deletedChunks?: number; error?: string }> =>
    ipcRenderer.invoke('delete-documents', ids),
  dropDocumentsTable: (): Promise<{ success: boolean; existed?: boolean; error?: string }> =>
    ipcRenderer.invoke('drop-documents-table'),
  documentListRefresh: (cb: () => void) => ipcRenderer.on('document-list-refresh', () => cb()),
  removeDocumentListRefreshListeners: () => ipcRenderer.removeAllListeners('document-list-refresh'),
  downloadModel: (repoId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('download-model', repoId),
  onDownloadProgress: (
    cb: (progressData: {
      repoId: string
      file?: string
      status: string
      progress: number
      totalFiles?: number
      completedFiles?: number
      error?: string
    }) => void
  ) => ipcRenderer.on('download-progress', (_event, data) => cb(data)),
  removeDownloadProgressListeners: () => ipcRenderer.removeAllListeners('download-progress'),
  getModels: (): Promise<any[]> => ipcRenderer.invoke('get-models'),
  getEmbeddingStatus: (): Promise<string> => ipcRenderer.invoke('get-embedding-status'),
  readFile: (filePath: string): Promise<Uint8Array> => ipcRenderer.invoke('read-file', filePath),

  // Chat & LLM
  chatSessionList: (): Promise<any[]> => ipcRenderer.invoke('chat-session-list'),
  chatSessionSave: (session: any): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('chat-session-save', session),
  chatSessionDelete: (id: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('chat-session-delete', id),
  chatMessageList: (sessionId: string): Promise<any[]> =>
    ipcRenderer.invoke('chat-message-list', sessionId),
  chatMessageSave: (message: any): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('chat-message-save', message),
  llmConfigList: (): Promise<any[]> => ipcRenderer.invoke('llm-config-list'),
  llmConfigSave: (config: any): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('llm-config-save', config),
  llmConfigDelete: (id: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('llm-config-delete', id),
  llmConfigSetActive: (id: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('llm-config-set-active', id)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
