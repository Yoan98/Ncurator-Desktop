import fs from 'fs'
import path from 'path'
import { MODELS_PATH } from '../../utils/paths'

const HF_ENDPOINT = 'https://hf-mirror.com'
const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export interface ModelInfo {
  id: string
  name: string
  description: string
  tags: string[]
  isDownloaded: boolean
}

export class ModelService {
  private static instance: ModelService

  private constructor() {}

  public static getInstance(): ModelService {
    if (!ModelService.instance) {
      ModelService.instance = new ModelService()
    }
    return ModelService.instance
  }

  public getModels(): ModelInfo[] {
    const models = [
      {
        id: 'jinaai/jina-embeddings-v2-base-zh',
        name: '中文模型 ',
        description: '专为中文语境优化，适合大多数中文知识库场景。',
        tags: ['中文优化', '1.12GB']
      }
    ]

    return models.map((m) => {
      const modelPath = path.join(MODELS_PATH, m.id)
      // Simple check: if directory exists and has some files.
      // For more robust check, we might check for config.json or model.onnx
      const isDownloaded = fs.existsSync(modelPath) && fs.readdirSync(modelPath).length > 0
      return { ...m, isDownloaded }
    })
  }

  async downloadModel(repoId: string, eventSender: Electron.WebContents) {
    try {
      console.log(`[ModelService] Starting download for ${repoId}`)
      const modelPath = path.join(MODELS_PATH, repoId)

      // Create model directory
      if (!fs.existsSync(modelPath)) {
        fs.mkdirSync(modelPath, { recursive: true })
      }

      // 1. Fetch metadata
      const metadataUrl = `${HF_ENDPOINT}/api/models/${repoId}`
      console.log(`[ModelService] Fetching metadata from ${metadataUrl}`)
      const response = await fetch(metadataUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.statusText}`)
      }
      const metadata = await response.json()

      // 2. Filter files (siblings)
      const siblings = metadata.siblings || []
      const filesToDownload = siblings.filter(() => {
        // Exclude safe tensors if needed, or include everything.
        // Usually we need .json, .txt, .model, .bin, .safetensors
        // hfd.sh downloads everything by default unless excluded.
        // We will download everything.
        return true
      })

      console.log(`[ModelService] Found ${filesToDownload.length} files to download`)

      let completedFiles = 0
      const totalFiles = filesToDownload.length

      for (const file of filesToDownload) {
        const filename = file.rfilename
        const fileUrl = `${HF_ENDPOINT}/${repoId}/resolve/main/${filename}`
        const filePath = path.join(modelPath, filename)
        const fileDir = path.dirname(filePath)

        if (!fs.existsSync(fileDir)) {
          fs.mkdirSync(fileDir, { recursive: true })
        }

        console.log(`[ModelService] Downloading ${filename}...`)

        // Notify start of file
        eventSender.send('download-progress', {
          repoId,
          file: filename,
          status: 'downloading',
          progress: 0,
          totalFiles,
          completedFiles
        })

        await this.downloadFile(fileUrl, filePath, () => {
          // Throttled updates could be better, but for now sending every chunk might be too much.
          // We can just send per-file completion or rough progress if needed.
          // For simplicity, let's just update "downloading file X"
        })

        completedFiles++

        eventSender.send('download-progress', {
          repoId,
          file: filename,
          status: 'downloading',
          progress: Math.round((completedFiles / totalFiles) * 100),
          totalFiles,
          completedFiles
        })
      }

      console.log(`[ModelService] Download complete for ${repoId}`)
      eventSender.send('download-progress', {
        repoId,
        status: 'completed',
        progress: 100
      })

      return { success: true }
    } catch (error: unknown) {
      console.error('[ModelService] Download error:', error)
      eventSender.send('download-progress', {
        repoId,
        status: 'error',
        error: getErrorMessage(error)
      })
      throw error
    }
  }

  private async downloadFile(
    url: string,
    destPath: string,
    onProgress: (progress: number) => void
  ) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to download ${url}: ${response.statusText}`)
    if (!response.body) throw new Error(`No body in response for ${url}`)

    const fileStream = fs.createWriteStream(destPath)
    const reader = response.body.getReader()
    const contentLength = +(response.headers.get('Content-Length') || 0)
    let receivedLength = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      fileStream.write(Buffer.from(value))
      receivedLength += value.length
      if (contentLength > 0) {
        onProgress(receivedLength / contentLength)
      }
    }

    fileStream.end()
  }
}
