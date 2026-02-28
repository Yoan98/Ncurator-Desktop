import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AiRunEvent,
  SearchSourceFilter
} from '../shared/types'
import type { DesktopApi } from './api'

// Custom APIs for renderer
const api: DesktopApi = {
  ingestFile: (file: File): Promise<{ success: boolean; count?: number; error?: string }> =>
    ipcRenderer.invoke('ingest-file', webUtils.getPathForFile(file), file.name),
  ingestFiles: (files: File[]): Promise<{ success: boolean; created?: number; error?: string }> =>
    ipcRenderer.invoke(
      'ingest-files',
      files.map((f) => ({ path: webUtils.getPathForFile(f), name: f.name }))
    ),
  ingestWeb: (payload): Promise<{ success: boolean; count?: number; error?: string }> =>
    ipcRenderer.invoke('ingest-web', payload),
  ingestWebs: (payload): Promise<{ success: boolean; created?: number; error?: string }> =>
    ipcRenderer.invoke('ingest-webs', payload),
  openExternal: (url: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('open-external', url),
  openPath: (filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('open-path', filePath),
  revealPath: (filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('reveal-path', filePath),
  search: (
    query: string,
    sourceType?: SearchSourceFilter
  ) =>
    ipcRenderer.invoke('search', query, sourceType),
  ftsSearch: (query: string, sourceType?: SearchSourceFilter) =>
    ipcRenderer.invoke('fts-search', query, sourceType),
  vectorSearch: (query: string, sourceType?: SearchSourceFilter) =>
    ipcRenderer.invoke('vector-search', query, sourceType),
  hybridSearch: (query: string, sourceType?: SearchSourceFilter) =>
    ipcRenderer.invoke('hybrid-search', query, sourceType),
  listDocuments: (payload) => ipcRenderer.invoke('list-documents', payload),
  listChunks: (payload) => ipcRenderer.invoke('list-chunks', payload),
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
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_event, data) => cb(data)),
  removeDownloadProgressListeners: () => ipcRenderer.removeAllListeners('download-progress'),
  getModels: () => ipcRenderer.invoke('get-models'),
  getEmbeddingStatus: () => ipcRenderer.invoke('get-embedding-status'),
  readFile: (filePath: string): Promise<Uint8Array> => ipcRenderer.invoke('read-file', filePath),

  // Chat & LLM
  chatSessionList: () => ipcRenderer.invoke('chat-session-list'),
  chatSessionSave: (session) =>
    ipcRenderer.invoke('chat-session-save', session),
  chatSessionDelete: (id: string) =>
    ipcRenderer.invoke('chat-session-delete', id),
  chatMessageList: (sessionId: string) =>
    ipcRenderer.invoke('chat-message-list', sessionId),
  chatMessageSave: (message) =>
    ipcRenderer.invoke('chat-message-save', message),
  llmConfigList: () => ipcRenderer.invoke('llm-config-list'),
  llmConfigSave: (config) =>
    ipcRenderer.invoke('llm-config-save', config),
  llmConfigDelete: (id: string) =>
    ipcRenderer.invoke('llm-config-delete', id),
  llmConfigSetActive: (id: string) =>
    ipcRenderer.invoke('llm-config-set-active', id),

  aiRunStart: (payload) =>
    ipcRenderer.invoke('ai-run-start', payload),
  aiRunCancel: (runId: string) => ipcRenderer.invoke('ai-run-cancel', runId),
  aiRunApprovalDecide: (payload) => ipcRenderer.invoke('ai-run-approval-decide', payload),
  onAiRunEvent: (cb: (event: AiRunEvent) => void) =>
    ipcRenderer.on('ai-run-event', (_event, data) => cb(data)),
  removeAiRunEventListeners: () => ipcRenderer.removeAllListeners('ai-run-event')
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
