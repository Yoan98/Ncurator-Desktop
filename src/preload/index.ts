import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { SearchResult, DocumentListResponse } from '../main/types/store'

// Custom APIs for renderer
const api = {
  ingestFile: (file: File): Promise<{ success: boolean; count?: number; error?: string }> =>
    ipcRenderer.invoke('ingest-file', webUtils.getPathForFile(file), file.name),
  search: (query: string): Promise<{ results: SearchResult[]; tokens: string[] }> =>
    ipcRenderer.invoke('search', query),
  ftsSearch: (query: string): Promise<SearchResult[]> => ipcRenderer.invoke('fts-search', query),
  vectorSearch: (query: string): Promise<SearchResult[]> =>
    ipcRenderer.invoke('vector-search', query),
  hybridSearch: (query: string): Promise<SearchResult[]> =>
    ipcRenderer.invoke('hybrid-search', query),
  listDocuments: (payload: {
    keyword?: string
    page: number
    pageSize: number
  }): Promise<DocumentListResponse> => ipcRenderer.invoke('list-documents', payload),
  dropDocumentsTable: (): Promise<{ success: boolean; existed?: boolean; error?: string }> =>
    ipcRenderer.invoke('drop-documents-table')
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
