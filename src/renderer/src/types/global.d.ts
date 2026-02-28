import type { ElectronAPI } from '@electron-toolkit/preload'
import type { DesktopApi } from '../../../preload/api'

declare global {
  interface Window {
    electron: ElectronAPI
    api: DesktopApi
  }
}
