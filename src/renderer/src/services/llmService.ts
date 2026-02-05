import OpenAI from 'openai'
import type { ChatMessage, LLMConfig } from '../../../shared/types'

export type { ChatMessage, LLMConfig }

// Helper to get active config asynchronously
export const getActiveConfig = async (): Promise<LLMConfig | null> => {
  try {
    const configs = await window.api.llmConfigList()
    return configs.find((c) => c.is_active) || null
  } catch (e) {
    console.error('Failed to load LLM configs', e)
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
    let baseURL = config.base_url
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
      apiKey: config.api_key,
      dangerouslyAllowBrowser: true
    })

    const stream = await client.chat.completions.create({
      model: config.model_name,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content
      })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
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
