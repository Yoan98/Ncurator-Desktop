import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ingestFile: (file: File) => Promise<{ success: boolean; count?: number; error?: string }>
      search: (query: string) => Promise<any[]>
    }
  }
}
