import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ingestFile: (
        filePath: string,
        filename: string
      ) => Promise<{ success: boolean; count?: number; error?: string }>
      search: (query: string) => Promise<any[]>
    }
  }
}
