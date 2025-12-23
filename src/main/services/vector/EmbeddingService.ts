import { pipeline, env } from '@xenova/transformers';
import { MODELS_PATH } from '../../utils/paths';
import path from 'path';

// Configuration for local models
env.localModelPath = MODELS_PATH;
env.allowRemoteModels = true; // Allow downloading if not present

export class EmbeddingService {
  private static instance: EmbeddingService;
  private pipe: any = null;
  private modelName: string = 'Xenova/jina-embeddings-v2-base-zh'; // Using a Chinese model as default for now

  private constructor() {}

  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  public async initialize() {
    if (this.pipe) return;
    
    // Feature extraction pipeline
    this.pipe = await pipeline('feature-extraction', this.modelName, {
      quantized: true,
    });
  }

  public async embed(text: string): Promise<number[]> {
    if (!this.pipe) await this.initialize();

    const output = await this.pipe(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data);
  }
}
