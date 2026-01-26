import OpenAI from 'openai'

export interface LLMConfig {
  id: string
  name: string
  baseUrl: string
  modelName: string
  apiKey: string
  isActive: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export const STORAGE_KEY_CONFIGS = 'ncurator_llm_configs'

export const getActiveConfig = (): LLMConfig | null => {
  try {
    const configsStr = localStorage.getItem(STORAGE_KEY_CONFIGS)
    if (!configsStr) return null
    const configs: LLMConfig[] = JSON.parse(configsStr)
    return configs.find((c) => c.isActive) || null
  } catch (e) {
    console.error('Failed to parse LLM configs', e)
    return null
  }
}

export const streamCompletion = async (
  messages: ChatMessage[],
  config: LLMConfig,
  onChunk: (content: string) => void,
  onError: (error: Error) => void,
  onFinish: () => void
): Promise<void> => {
  try {
    let baseURL = config.baseUrl
    // OpenAI SDK appends /chat/completions automatically, so we need to strip it if present
    if (baseURL.endsWith('/chat/completions')) {
      baseURL = baseURL.replace(/\/chat\/completions\/?$/, '')
    } else if (baseURL.endsWith('/v1/chat/completions')) {
      // Some users might paste the full URL including /v1...
      // Ideally we want the base that includes /v1 if the provider expects it,
      // but OpenAI SDK expects the base URL to be where /chat/completions is appended.
      // E.g. https://api.openai.com/v1 -> https://api.openai.com/v1/chat/completions
      // So if user provided .../v1/chat/completions, we want .../v1
      baseURL = baseURL.replace(/\/chat\/completions\/?$/, '')
    }

    // Ensure no trailing slash
    baseURL = baseURL.replace(/\/$/, '')

    const client = new OpenAI({
      baseURL,
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true
    })

    const stream = await client.chat.completions.create({
      model: config.modelName,
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      stream: true
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        onChunk(content)
      }
    }

    onFinish()
  } catch (error) {
    console.error('LLM Service Error:', error)
    onError(error instanceof Error ? error : new Error(String(error)))
  }
}
