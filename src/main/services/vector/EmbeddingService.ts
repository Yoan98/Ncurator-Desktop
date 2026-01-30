import { pipeline, env } from '@huggingface/transformers'
import { MODELS_PATH } from '../../utils/paths'

console.log('MODELS_PATH', MODELS_PATH)
env.localModelPath = MODELS_PATH
// env.backends.onnx.wasm.wasmPaths = './wasm';
env.allowRemoteModels = false
env.allowLocalModels = true

enum ServiceStatus {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error'
}

export class EmbeddingService {
  private static instance: EmbeddingService
  private extractor: any = null
  private modelName: string = 'jinaai/jina-embeddings-v2-base-zh' // Using a Chinese model as default for now
  private status: ServiceStatus = ServiceStatus.UNINITIALIZED

  private constructor() {}

  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService()
    }
    return EmbeddingService.instance
  }

  public async initialize() {
    if (this.status === ServiceStatus.READY) return

    if (this.status === ServiceStatus.INITIALIZING) {
      return
    }

    this.status = ServiceStatus.INITIALIZING
    try {
      // Feature extraction pipeline
      // Check if model exists locally first? transformers.js usually handles this if localModelPath is set.
      // However, if files are missing, it might throw.
      // We should wrap this in try-catch and set status to UNINITIALIZED or ERROR if it fails due to missing model,
      // but let's see. If we catch error, we can stay in UNINITIALIZED or specific ERROR state.
      
      this.extractor = await pipeline('feature-extraction', this.modelName, {
        dtype: 'fp32'
      })
      this.status = ServiceStatus.READY
    } catch (error: any) {
      console.warn('EmbeddingService initialization failed (likely model missing):', error.message)
      // Do not throw, just set status to ERROR so app can continue
      this.status = ServiceStatus.ERROR
    }
  }

  public getStatus() {
    return this.status
  }

  public async embed(
    texts: string | string[]
  ): Promise<{ data: Float32Array; dims: [number, number] }> {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `EmbeddingService is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }

    const inputTexts = Array.isArray(texts) ? texts : [texts]

    const output = await this.extractor(inputTexts, {
      pooling: 'mean',
      normalize: true
    })

    const data = output.data as Float32Array
    const dims = output.dims as [number, number]

    return {
      data,
      dims
    }
  }
}
