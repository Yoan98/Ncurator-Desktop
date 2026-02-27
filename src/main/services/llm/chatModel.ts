import { ChatOpenAI } from '@langchain/openai'
import type { LLMConfig } from '../../types/store'

export type ChatModelFactoryOptions = {
  temperature?: number
  maxRetries?: number
  timeout?: number
}

const normalizeBaseURL = (baseURL: string) => {
  let url = String(baseURL || '').trim()
  if (url.endsWith('/chat/completions')) url = url.replace(/\/chat\/completions\/?$/, '')
  if (url.endsWith('/v1/chat/completions')) url = url.replace(/\/chat\/completions\/?$/, '')
  url = url.replace(/\/$/, '')
  return url
}

export const createChatModel = (cfg: LLMConfig, opts?: ChatModelFactoryOptions) => {
  return new ChatOpenAI({
    model: cfg.model_name,
    apiKey: cfg.api_key,
    temperature: opts?.temperature ?? 0.2,
    maxRetries: opts?.maxRetries ?? 2,
    timeout: opts?.timeout,
    configuration: {
      baseURL: normalizeBaseURL(cfg.base_url)
    }
  })
}
