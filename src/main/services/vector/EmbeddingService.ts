import { pipeline, env } from '@huggingface/transformers'
import { MODELS_PATH } from '../../utils/paths'

console.log('MODELS_PATH', MODELS_PATH)
env.localModelPath = MODELS_PATH
// env.backends.onnx.wasm.wasmPaths = './wasm';
env.allowRemoteModels = false
env.allowLocalModels = true

export class EmbeddingService {
  private static instance: EmbeddingService
  private extractor: any = null
  private modelName: string = 'jinaai/jina-embeddings-v2-base-zh' // Using a Chinese model as default for now

  private constructor() {}

  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService()
    }
    return EmbeddingService.instance
  }

  public async initialize() {
    if (this.extractor) return

    // Feature extraction pipeline
    this.extractor = await pipeline('feature-extraction', this.modelName, {
      dtype: 'fp32'
    })
  }

  public async embed(
    texts: string | string[]
  ): Promise<{ data: Float32Array; dims: [number, number] }> {
    if (!this.extractor) await this.initialize()

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
