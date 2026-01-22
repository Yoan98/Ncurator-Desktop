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
    let url = config.baseUrl
    if (!url.endsWith('/v1/chat/completions') && !url.endsWith('/chat/completions')) {
        // Simple heuristic to append endpoint if missing, though user might provide full URL
        // Better to assume user provides base URL like https://api.openai.com/v1
        url = url.replace(/\/$/, '') + '/chat/completions'
    }

    // Handle cases where user provides the full chat completion URL
    if (config.baseUrl.includes('/chat/completions')) {
        url = config.baseUrl
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: messages,
        stream: true
      })
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
    }

    if (!response.body) {
        throw new Error('Response body is empty')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk
      
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        
        const dataStr = trimmed.slice(6)
        if (dataStr === '[DONE]') continue

        try {
          const data = JSON.parse(dataStr)
          const content = data.choices?.[0]?.delta?.content
          if (content) {
            onChunk(content)
          }
        } catch (e) {
          console.warn('Failed to parse SSE message', e)
        }
      }
    }
    
    onFinish()
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)))
  }
}
