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

type FeatureExtractorResult = {
  data: unknown
  dims: unknown
}

type FeatureExtractor = (
  texts: string[],
  options: { pooling: 'mean'; normalize: true }
) => Promise<FeatureExtractorResult>

const toEmbeddingDims = (value: unknown): [number, number] => {
  if (!Array.isArray(value)) return [0, 0]
  return [Number(value[0] ?? 0), Number(value[1] ?? 0)]
}

const toEmbeddingVector = (value: unknown): Float32Array => {
  if (value instanceof Float32Array) return value
  if (Array.isArray(value)) return Float32Array.from(value.map((v) => Number(v || 0)))
  return new Float32Array()
}

export class EmbeddingService {
  private static instance: EmbeddingService
  private extractor: FeatureExtractor | null = null
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
      // transformers.js pipeline return type is dynamic; keep it isolated in this adapter field.
      const createExtractor = pipeline as (
        task: string,
        model: string,
        options: { dtype: 'fp32' }
      ) => Promise<FeatureExtractor>
      this.extractor = await createExtractor('feature-extraction', this.modelName, { dtype: 'fp32' })
      this.status = ServiceStatus.READY
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('EmbeddingService initialization failed (likely model missing):', message)
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
    if (!this.extractor) {
      throw new Error('EmbeddingService extractor is not initialized')
    }

    const output = await this.extractor(inputTexts, {
      pooling: 'mean',
      normalize: true
    })

    const data = toEmbeddingVector(output.data)
    const dims = toEmbeddingDims(output.dims)

    return {
      data,
      dims
    }
  }
}
