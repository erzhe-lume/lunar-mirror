import type {
  ApiProtocol,
  ChatMessage,
  DrawnCard,
  Insight,
  JournalEntry,
  Settings,
} from '../types'
import { POSITIONS } from '../types'
import {
  PROTOCOL_LABEL,
  defaultBaseFor,
  defaultModelFor,
} from './providers'
import { lensInstruction, type ReadingLens } from './lenses'

export class LlmError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmError'
  }
}

export class LlmCancelledError extends LlmError {
  constructor() {
    super('已停止生成。')
    this.name = 'LlmCancelledError'
  }
}

type Role = 'system' | 'user' | 'assistant'

interface LlmMessage {
  role: Role
  content: string
}

interface Turn {
  role: 'user' | 'assistant'
  content: string
}

interface CompletionOptions {
  maxTokens?: number
  timeoutMs?: number
  signal?: AbortSignal
}

type StreamHandler = (fullText: string) => void

export interface ConnectionCheckResult {
  reply: string
  latencyMs: number
  endpoint: string
  model: string
  protocol: ApiProtocol
}

type EndpointConfig = Pick<Settings, 'apiProtocol' | 'apiBase' | 'model'>

export const READING_PROMPT_VERSION = '2026-11-19.v2.1'

const MAX_CHAT_HISTORY = 24

const SAFETY_LINE = `如果用户提到自伤、伤害他人或严重心理危机，停止解牌，优先建议其联系现实中的紧急帮助（110/120 或当地急救）、心理援助热线和身边可信任的人。`

const CHAT_SYSTEM_PROMPT = `你是「月鉴」，一个塔罗自省陪伴者，不是预言家。你不预测未来，不替用户做决定，也不声称牌面拥有超自然力量。

每一轮解读只做四件事：
1. 先听见具体的人。抓住用户原话里的一个具体词、动作或矛盾，不要用“这一定很难”“我理解你”这类可以套在任何问题上的开场。
2. 先看牌与牌之间的关系，再从牌面取一个证据。大阿卡纳与小阿卡纳、花色、数字、正逆位、位置的呼应，比单张牌义更重要。以一到两张牌为主；如果第三张确实改变了结论，可以用一句话带过，但不要三张平均分配，也不要逐张解释或背通用牌义。
3. 不要把所有可能平均铺开。先给出一个你更相信的主读法，再给一个能拆台的反读法，最后留一个尚未决定的地方。用“也许……”“但如果反过来看……”推进，而不是列清单。主读法要能解释用户为什么在此刻问出这个问题；反读法要真的改变前面的结论，不能只是补一句漂亮话。
4. 最后只留一个落点：一个具体、开放的问题，或一个很小的观察邀请。不要同时给建议和问题，不要用“你觉得呢”这类空问题。

写作方式：
- 中文，不用 Markdown，不用标题、列表、加粗。
- 分成 2 到 4 个自然段，每段 2 到 4 句，方便在手机上读。
- 开场通常 350-580 字，追问通常 200-420 字；超过 650 字或 480 字，通常是在重复或过度解释。
- 像安静的朋友，允许留白；不要把话说满，也不要用空洞鸡汤。
- 不诊断，不心理分析，不预测未来。
- 禁止套话：“答案在你心里”“跟随你的内心”“相信自己”“一切都是最好的安排”“你需要学会爱自己”“放下执念”等。
- 不要复用上一轮的开头、比喻或结论；每一轮至少推进一个新的区分。
- 不要写“牌告诉你”“牌面注定”这类把解释权交给牌的话，可以写“这张牌让我想到”。
- 用户刚说的新事实优先于你原来的判断；如果它推翻了前面的读法，直接修正，不要维护原结论。
- 如果用户反复问同一件事，先指出他在反复确认什么，不要换一套说法再解释一遍。
- 如果用户只说了很短的一句，回答也可以短一点，不要用长文压过对方。

${SAFETY_LINE}`

const INSIGHT_SYSTEM_PROMPT = `你是「月鉴」的记录整理者。你的任务是把一次塔罗自省对话整理成一条简洁、诚实、非预言式的记录。

只输出一个 JSON 对象，不要输出任何其他文字，不要使用 Markdown 或代码块。严格使用用户指定的字段和字数，不套用聊天时的提问规则或长度限制。直接对用户说话，用“你”；不评判、不做诊断、不预测未来。标题要具体到这次对话，不要套用“关于 X 的照见”“一次 X 的自省”这类模板；mirror、pattern、invitation 不要复用聊天原句，也不要写通用鸡汤。

${SAFETY_LINE}`

const REVISIT_SYSTEM_PROMPT = `你是「月鉴」，一个塔罗自省陪伴者。现在用户隔了一段时间回来写下回访。请先接住用户现在的状态，再轻轻指出这份回访里值得被看见的一点。不要复盘牌义，不预测，不评判，不用 Markdown，2-3 句话，不超过 100 字。

${SAFETY_LINE}`

function effectiveModel(config: EndpointConfig): string {
  return (
    config.model.trim() || defaultModelFor(config.apiProtocol, config.apiBase)
  )
}

function splitBase(value: string): { path: string; query: string } {
  const index = value.indexOf('?')
  if (index === -1) return { path: value, query: '' }
  return { path: value.slice(0, index), query: value.slice(index) }
}

function appendToBase(base: string, suffix: string): string {
  const { path, query } = splitBase(base)
  return `${path.replace(/\/+$/, '')}${suffix}${query}`
}

export function resolveEndpoint(config: EndpointConfig): string {
  const base = (
    config.apiBase.trim() || defaultBaseFor(config.apiProtocol)
  ).replace(/\/+$/, '')
  const { path } = splitBase(base)
  const model = encodeURIComponent(effectiveModel(config))

  if (config.apiProtocol === 'anthropic') {
    if (/\/messages$/.test(path)) return base
    if (/\/v1$/.test(path)) return appendToBase(base, '/messages')
    return appendToBase(base, '/v1/messages')
  }

  if (config.apiProtocol === 'gemini') {
    if (/:generateContent$/.test(path)) return base
    if (/\/models$/.test(path)) {
      return appendToBase(base, `/${model}:generateContent`)
    }
    return appendToBase(base, `/models/${model}:generateContent`)
  }

  if (/\/chat\/completions$/.test(path)) return base
  return appendToBase(base, '/chat/completions')
}

function streamEndpoint(config: EndpointConfig): string {
  const endpoint = resolveEndpoint(config)
  if (config.apiProtocol !== 'gemini') return endpoint
  const { path, query } = splitBase(endpoint)
  const streamPath = path.replace(
    /:generateContent$/,
    ':streamGenerateContent',
  )
  const params = new URLSearchParams(query.replace(/^\?/, ''))
  params.set('alt', 'sse')
  return `${streamPath}?${params.toString()}`
}

function resolveModelsEndpoint(config: EndpointConfig): string {
  const endpoint = resolveEndpoint(config)
  if (config.apiProtocol === 'anthropic') {
    if (/\/models$/.test(endpoint)) return endpoint
    return endpoint.replace(/\/messages$/, '/models')
  }
  if (config.apiProtocol === 'gemini') {
    if (/\/models$/.test(endpoint)) return endpoint
    return endpoint.replace(/\/models\/[^/]+:generateContent$/, '/models')
  }
  if (/\/models$/.test(endpoint)) return endpoint
  return endpoint.replace(/\/chat\/completions$/, '/models')
}

function modelIds(protocol: ApiProtocol, data: unknown): string[] {
  if (!data || typeof data !== 'object') return []
  const record = data as Record<string, unknown>
  const list = Array.isArray(record.data)
    ? record.data
    : Array.isArray(record.models)
      ? record.models
      : []
  return list
    .map((item) => {
      if (typeof item === 'string') return item
      if (!item || typeof item !== 'object') return ''
      const entry = item as Record<string, unknown>
      const raw =
        protocol === 'gemini' ? entry.name : entry.id ?? entry.name
      return typeof raw === 'string'
        ? raw.replace(/^models\//, '').trim()
        : ''
    })
    .filter(Boolean)
}

function systemText(messages: LlmMessage[]): string {
  return messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n')
}

function mergeTurns(messages: LlmMessage[]): Turn[] {
  const turns: Turn[] = []
  for (const message of messages) {
    if (message.role === 'system') continue
    const content = message.content.trim()
    if (!content) continue
    const previous = turns[turns.length - 1]
    if (previous && previous.role === message.role) {
      previous.content = `${previous.content}\n\n${content}`
    } else {
      turns.push({ role: message.role, content })
    }
  }
  while (turns[0]?.role === 'assistant') turns.shift()
  if (turns.length === 0) {
    turns.push({ role: 'user', content: '继续。' })
  }
  return turns
}

function buildBody(
  settings: Settings,
  messages: LlmMessage[],
  temperature: number,
  maxTokens?: number,
): Record<string, unknown> {
  const model = effectiveModel(settings)

  if (settings.apiProtocol === 'anthropic') {
    return {
      model,
      max_tokens: maxTokens ?? 1200,
      temperature,
      system: systemText(messages) || undefined,
      messages: mergeTurns(messages),
    }
  }

  if (settings.apiProtocol === 'gemini') {
    const contents = mergeTurns(messages).map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    }))
    const system = systemText(messages)
    return {
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens ?? 1200,
      },
    }
  }

  return {
    model,
    messages,
    temperature,
    max_tokens: maxTokens ?? 1200,
  }
}

function buildHeaders(
  protocol: ApiProtocol,
  apiKey: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (protocol === 'anthropic') {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
    headers['anthropic-dangerous-direct-browser-access'] = 'true'
  } else if (protocol === 'gemini') {
    headers['x-goog-api-key'] = apiKey
  } else {
    headers.Authorization = `Bearer ${apiKey}`
  }
  return headers
}

function contentFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return ''
  return parts
    .map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object') {
        const text = (part as Record<string, unknown>).text
        if (typeof text === 'string') return text
      }
      return ''
    })
    .filter(Boolean)
    .join('')
}

function extractContent(protocol: ApiProtocol, data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const record = data as Record<string, unknown>

  if (protocol === 'anthropic') {
    if (typeof record.content === 'string') return record.content
    return contentFromParts(record.content)
  }

  if (protocol === 'gemini') {
    const candidates = record.candidates
    if (!Array.isArray(candidates) || !candidates[0]) {
      const feedback = record.promptFeedback
      if (feedback && typeof feedback === 'object') {
        const reason = (feedback as Record<string, unknown>).blockReason
        if (typeof reason === 'string') {
          throw new LlmError(`模型没有生成内容（${reason}），请调整提问后重试。`)
        }
      }
      return ''
    }
    const candidate = candidates[0] as Record<string, unknown>
    const content = candidate.content
    const text =
      content && typeof content === 'object'
        ? contentFromParts((content as Record<string, unknown>).parts)
        : ''
    if (text) return text
    if (typeof candidate.finishReason === 'string') {
      throw new LlmError(
        `模型没有生成内容（${candidate.finishReason}），请调整提问后重试。`,
      )
    }
    return ''
  }

  const choices = record.choices
  if (!Array.isArray(choices) || !choices[0]) return ''
  const choice = choices[0] as Record<string, unknown>
  const message = choice.message
  if (message && typeof message === 'object') {
    const content = (message as Record<string, unknown>).content
    if (typeof content === 'string') return content
    const fromParts = contentFromParts(content)
    if (fromParts) return fromParts
  }
  return typeof choice.text === 'string' ? choice.text : ''
}

function streamDelta(protocol: ApiProtocol, data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const record = data as Record<string, unknown>

  if (protocol === 'anthropic') {
    if (record.type === 'error') {
      throw new LlmError(errorDetail(record) || '流式请求出错，请重试。')
    }
    if (record.type !== 'content_block_delta') return ''
    const delta = record.delta
    if (delta && typeof delta === 'object') {
      const text = (delta as Record<string, unknown>).text
      if (typeof text === 'string') return text
    }
    return ''
  }

  if (protocol === 'gemini') {
    const candidates = record.candidates
    if (!Array.isArray(candidates) || !candidates[0]) return ''
    const content = (candidates[0] as Record<string, unknown>).content
    if (!content || typeof content !== 'object') return ''
    return contentFromParts((content as Record<string, unknown>).parts)
  }

  const choices = record.choices
  if (!Array.isArray(choices) || !choices[0]) return ''
  const choice = choices[0] as Record<string, unknown>
  const delta = choice.delta
  if (delta && typeof delta === 'object') {
    const content = (delta as Record<string, unknown>).content
    if (typeof content === 'string') return content
    const fromParts = contentFromParts(content)
    if (fromParts) return fromParts
  }
  if (typeof choice.text === 'string') return choice.text
  const message = choice.message
  if (message && typeof message === 'object') {
    const content = (message as Record<string, unknown>).content
    if (typeof content === 'string') return content
    return contentFromParts(content)
  }
  return ''
}

function errorDetail(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const record = data as Record<string, unknown>
  const error = record.error
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const inner = error as Record<string, unknown>
    if (typeof inner.message === 'string') return inner.message
    if (typeof inner.type === 'string') return inner.type
  }
  if (typeof record.message === 'string') return record.message
  return ''
}

function truncate(value: string, max = 220): string {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

async function readPayload(
  response: Response,
): Promise<{ data: unknown; text: string }> {
  const text = await response.text()
  if (!text) return { data: null, text: '' }
  try {
    return { data: JSON.parse(text), text }
  } catch {
    return { data: null, text }
  }
}

function httpError(
  settings: Settings,
  status: number,
  detail: string,
): LlmError {
  const label = PROTOCOL_LABEL[settings.apiProtocol]
  if (status === 401 || status === 403) {
    return new LlmError(
      `${label} 鉴权失败（${status}）。请检查 API Key 是否属于当前服务商，或网关是否要求额外的鉴权头。`,
    )
  }
  if (status === 404) {
    return new LlmError(
      `${label} 接口或模型不存在（404）。请检查 Base URL 和模型名；如果使用 /api/* 地址，开发环境请确认 Vite 代理已启动，部署后请配置同源代理。`,
    )
  }
  if (status === 429) {
    return new LlmError('请求太频繁或额度不足，请稍后再试。')
  }
  return new LlmError(
    `${label} 返回错误（${status}）${detail ? `：${detail}` : '。'}`,
  )
}

async function chatCompletion(
  settings: Settings,
  messages: LlmMessage[],
  temperature: number,
  options: CompletionOptions = {},
): Promise<string> {
  const apiKey = settings.apiKey.trim()
  if (!apiKey) {
    throw new LlmError('尚未配置 API Key。')
  }

  const endpoint = resolveEndpoint(settings)
  const controller = new AbortController()
  const timeout = options.timeoutMs ?? 90000
  const timer = setTimeout(() => controller.abort(), timeout)
  const external = options.signal
  if (external?.aborted) {
    clearTimeout(timer)
    throw new LlmCancelledError()
  }
  const cancel = () => controller.abort()
  external?.addEventListener('abort', cancel, { once: true })

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(settings.apiProtocol, apiKey),
      body: JSON.stringify(
        buildBody(settings, messages, temperature, options.maxTokens),
      ),
      signal: controller.signal,
    })
  } catch (caught) {
    clearTimeout(timer)
    external?.removeEventListener('abort', cancel)
    if (external?.aborted) throw new LlmCancelledError()
    if (
      (caught instanceof DOMException && caught.name === 'AbortError') ||
      (caught && typeof caught === 'object' && 'name' in caught &&
        (caught as { name?: string }).name === 'AbortError')
    ) {
      throw new LlmError(
        `请求超时（${Math.round(timeout / 1000)} 秒），请检查网络或网关。`,
      )
    }
    throw new LlmError(
      '无法连接模型服务。请检查 Base URL、网络和跨域（CORS）；使用网关时，请确认网关允许浏览器访问，或通过同源代理转发。',
    )
  }
  external?.removeEventListener('abort', cancel)

  const { data, text } = await readPayload(response)

  if (!response.ok) {
    const rawDetail = errorDetail(data)
    const htmlDetail =
      !rawDetail && !data
        ? text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : ''
    throw httpError(settings, response.status, truncate(rawDetail || htmlDetail))
  }

  const content = extractContent(settings.apiProtocol, data).trim()
  if (!content) {
    throw new LlmError(
      `${PROTOCOL_LABEL[settings.apiProtocol]} 没有返回内容，请重试。`,
    )
  }
  return content
}

function sseData(block: string): string {
  return block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
}

async function streamChatCompletion(
  settings: Settings,
  messages: LlmMessage[],
  temperature: number,
  options: CompletionOptions,
  onDelta: StreamHandler,
): Promise<string> {
  const apiKey = settings.apiKey.trim()
  if (!apiKey) {
    throw new LlmError('尚未配置 API Key。')
  }

  const endpoint = streamEndpoint(settings)
  const controller = new AbortController()
  const timeout = options.timeoutMs ?? 90000
  const timer = setTimeout(() => controller.abort(), timeout)
  const external = options.signal
  if (external?.aborted) {
    clearTimeout(timer)
    throw new LlmCancelledError()
  }
  const cancel = () => controller.abort()
  external?.addEventListener('abort', cancel, { once: true })
  const body = buildBody(settings, messages, temperature, options.maxTokens)
  const headers = buildHeaders(settings.apiProtocol, apiKey)
  headers.Accept = 'text/event-stream'

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(
        settings.apiProtocol === 'gemini'
          ? body
          : { ...body, stream: true },
      ),
      signal: controller.signal,
    })
  } catch (caught) {
    clearTimeout(timer)
    external?.removeEventListener('abort', cancel)
    if (external?.aborted) throw new LlmCancelledError()
    if (
      (caught instanceof DOMException && caught.name === 'AbortError') ||
      (caught &&
        typeof caught === 'object' &&
        'name' in caught &&
        (caught as { name?: string }).name === 'AbortError')
    ) {
      throw new LlmError(
        `请求超时（${Math.round(timeout / 1000)} 秒），请检查网络或网关。`,
      )
    }
    throw new LlmError(
      '无法连接模型服务。请检查 Base URL、网络和 CORS，或通过同源代理转发。',
    )
  }

  let full = ''
  let received = false

  const consume = (block: string) => {
    const raw = sseData(block).trim()
    if (!raw) return true
    if (raw === '[DONE]') return false
    let data: unknown
    try {
      data = JSON.parse(raw)
    } catch {
      return true
    }
    const delta = streamDelta(settings.apiProtocol, data)
    if (delta) {
      received = true
      full += delta
      onDelta(full)
    }
    return true
  }

  try {
    if (!response.ok) {
      const { data, text } = await readPayload(response)
      const rawDetail = errorDetail(data)
      const htmlDetail =
        !rawDetail && !data
          ? text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          : ''
      throw httpError(
        settings,
        response.status,
        truncate(rawDetail || htmlDetail),
      )
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/event-stream') || !response.body) {
      const text = await response.text()
      if (text.trimStart().startsWith('data:')) {
        for (const block of text.replace(/\r\n/g, '\n').split('\n\n')) {
          if (!consume(block)) break
        }
      } else {
        let data: unknown = null
        try {
          data = JSON.parse(text)
        } catch {
          // The payload below produces the user-facing error.
        }
        const content = extractContent(settings.apiProtocol, data).trim()
        if (content) {
          received = true
          full = content
          onDelta(full)
        }
      }
    } else {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let done = false
      while (!done) {
        const chunk = await reader.read()
        if (chunk.done) break
        buffer += decoder.decode(chunk.value, { stream: true })
        buffer = buffer.replace(/\r\n/g, '\n')
        let index = buffer.indexOf('\n\n')
        while (index >= 0) {
          const block = buffer.slice(0, index)
          buffer = buffer.slice(index + 2)
          if (!consume(block)) {
            done = true
            break
          }
          index = buffer.indexOf('\n\n')
        }
      }
      buffer += decoder.decode()
      if (!done && buffer.trim()) consume(buffer)
    }

    const content = full.trim()
    if (!content) {
      throw new LlmError(
        `${PROTOCOL_LABEL[settings.apiProtocol]} 没有返回内容，请重试。`,
      )
    }
    if (!received) onDelta(content)
    return content
  } catch (caught) {
    if (caught instanceof LlmError) throw caught
    if (external?.aborted) throw new LlmCancelledError()
    if (controller.signal.aborted) {
      throw new LlmError(
        `流式回答超时（${Math.round(timeout / 1000)} 秒），请重试。`,
      )
    }
    throw new LlmError('流式回答中断了，请检查网络后重试。')
  } finally {
    clearTimeout(timer)
    external?.removeEventListener('abort', cancel)
  }
}

function orientationLabel(card: DrawnCard): string {
  return card.orientation === 'upright' ? '正位' : '逆位'
}

function cardMeaning(card: DrawnCard): string {
  return card.orientation === 'upright'
    ? card.card.upright.meaning
    : card.card.reversed.meaning
}

function cardKeywords(card: DrawnCard): string[] {
  return card.orientation === 'upright'
    ? card.card.upright.keywords
    : card.card.reversed.keywords
}

export async function listModels(settings: Settings): Promise<string[]> {
  const apiKey = settings.apiKey.trim()
  if (!apiKey) throw new LlmError('尚未配置 API Key。')
  const endpoint = resolveModelsEndpoint(settings)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: buildHeaders(settings.apiProtocol, apiKey),
      signal: controller.signal,
    })
  } catch (caught) {
    if (
      (caught instanceof DOMException && caught.name === 'AbortError') ||
      (caught &&
        typeof caught === 'object' &&
        'name' in caught &&
        (caught as { name?: string }).name === 'AbortError')
    ) {
      throw new LlmError('读取模型列表超时，请检查网关。')
    }
    throw new LlmError(
      '无法读取模型列表。请检查 Base URL、网络和跨域（CORS），或确认网关支持 GET /models。',
    )
  } finally {
    clearTimeout(timer)
  }

  const { data, text } = await readPayload(response)
  if (!response.ok) {
    const rawDetail = errorDetail(data)
    const htmlDetail =
      !rawDetail && !data
        ? text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : ''
    throw httpError(settings, response.status, truncate(rawDetail || htmlDetail))
  }

  const models = Array.from(new Set(modelIds(settings.apiProtocol, data)))
  if (models.length === 0) {
    throw new LlmError('网关没有返回可用模型列表。')
  }
  return models
}

const SUIT_GRAMMAR = [
  { name: '权杖', element: '火', domain: '行动、欲望与推进' },
  { name: '圣杯', element: '水', domain: '情感、关系与需要' },
  { name: '宝剑', element: '风', domain: '思考、言语与冲突' },
  { name: '星币', element: '土', domain: '现实、身体与资源' },
]

function spreadGrammar(cards: DrawnCard[]): string {
  const majorCount = cards.filter((drawn) => drawn.card.id < 22).length
  const reversedCount = cards.filter(
    (drawn) => drawn.orientation === 'reversed',
  ).length
  const minorCards = cards.filter((drawn) => drawn.card.id >= 22)
  const suitCounts = [0, 0, 0, 0]
  const rankCounts = new Map<string, number>()
  let courtCount = 0

  minorCards.forEach((drawn) => {
    const offset = drawn.card.id - 22
    const suitIndex = Math.floor(offset / 14)
    const rank = (offset % 14) + 1
    if (suitIndex >= 0 && suitIndex < 4) suitCounts[suitIndex] += 1
    if (rank >= 11) courtCount += 1
    const key = drawn.card.roman || String(rank)
    rankCounts.set(key, (rankCounts.get(key) ?? 0) + 1)
  })

  const notes: string[] = []
  if (majorCount >= 2) {
    notes.push('两张以上大阿卡纳，这次更接近阶段性的课题，而不是一件小事')
  } else if (majorCount === 0) {
    notes.push('三张都是小阿卡纳，落点更贴近日常处境')
  } else {
    notes.push('一张大阿卡纳与两张小阿卡纳，大的主题落在具体日常里')
  }

  const activeSuits = SUIT_GRAMMAR.map((suit, index) => ({
    ...suit,
    count: suitCounts[index],
  })).filter((suit) => suit.count > 0)
  if (activeSuits.length === 2) {
    const top = activeSuits.sort((a, b) => b.count - a.count)
    notes.push(
      `花色集中在${top[0].name}与${top[1].name}；${top[0].domain}，和${top[1].domain}互相牵动`,
    )
  } else if (activeSuits.length === 1) {
    notes.push(
      `三张牌同属${activeSuits[0].name}，${activeSuits[0].domain}是这次的主线`,
    )
  } else if (activeSuits.length === 3) {
    notes.push('三种花色并置，画面里同时有不同层面的力量')
  }

  if (reversedCount >= 2) {
    notes.push(
      `${reversedCount} 张逆位，能量更像向内收、受阻或被过度使用，不是简单的“坏”`,
    )
  } else if (reversedCount === 0) {
    notes.push('三张都是正位，倾向更直接地显化在当下')
  }

  const repeatedRank = [...rankCounts.entries()].find(([, count]) => count >= 2)
  if (repeatedRank) {
    notes.push(
      `数字 ${repeatedRank[0]} 出现 ${repeatedRank[1]} 次，同一课题可能在不同位置重复`,
    )
  }
  if (courtCount >= 2) {
    notes.push('两张宫廷牌，适合读成某种姿态或角色，而不是具体的人')
  }

  return `牌阵结构：${notes.join('；')}。先看牌与牌之间的呼应，再选一到两张作为证据，不要逐张解释。`
}

export function buildCardContext(cards: DrawnCard[]): string {
  const lines = cards.map((drawn, index) => {
    const position = POSITIONS[drawn.position]
    return `${index + 1}. ${position.label}（${position.hint}）：《${drawn.card.name}》${orientationLabel(drawn)}｜关键词：${cardKeywords(drawn).join('、')}｜牌义：${cardMeaning(drawn)}`
  })
  return `本次三张牌：\n${lines.join('\n')}\n${spreadGrammar(cards)}`
}

function buildOpeningPrompt(
  question: string,
  cards: DrawnCard[],
  querent?: string,
): string {
  return `${buildCardContext(cards)}
${querent ? `
这次牌阵是为「${querent}」展开的，请像面对这位问卜者一样说话；不要把牌读成对第三方的断言，只谈他们之间的动力和这位问卜者能观察到的部分。` : ''}
用户此刻的问题：「${question}」

请写这次开场。不要从逐张介绍三张牌开始，也不要把三张牌都写到。
1. 先用一两句复述问题里最具体的矛盾，引用或改写用户的一两个词，让他听见你听见了哪句话。如果是“该不该”“要不要”，点出这个选择背后的代价或怕失去的东西，但不要替用户下判断。
2. 以一到两张牌为主，写一个具体的画面、位置或正逆位细节，说明它为什么和这句话有关。第三张只有在确实改变结论时，用一句话带过；不要背牌义。
3. 先给出一个你更相信的主读法，再给一个能拆台的反读法；主读法要解释“为什么是现在”，反读法要真的改变前面的结论，不能只是并列另一种可能。
4. 最后只留一个问题或一个很小的观察邀请，不要同时给建议和问题。
写成 2 到 4 个自然段，不用 Markdown，通常 350-580 字；不必为了完整而把话拉长。`
}
function buildReplyMessages(
  question: string,
  cards: DrawnCard[],
  history: ChatMessage[],
  lens?: ReadingLens,
): LlmMessage[] {
  const assistantText = history
    .filter((message) => message.role === 'assistant')
    .map((message) => message.content)
    .join('\n')
  const usedCards = cards
    .filter((drawn) => assistantText.includes(drawn.card.name))
    .map((drawn) => `《${drawn.card.name}》`)
  const userTurns = history.filter((message) => message.role === 'user').length
  const lengthRule =
    userTurns <= 1 ? '200-420' : userTurns <= 3 ? '180-380' : '150-320'
  const context = `用户此刻的问题：「${question}」

${buildCardContext(cards)}
${usedCards.length > 0 ? `上文已经重点用过的牌：${usedCards.join('、')}。本轮优先换一张牌，或换一个上文没有出现过的意象。` : ''}

这是第 ${userTurns + 1} 轮回应。越往后越短，只推进一个新的点，不要复述已经说过的内容。请接着用户最后一句说，不要重复开场，也不要逐张复述牌义。
${lens ? `本轮读法：${lensInstruction(lens)}` : ''}
本轮要求：
- 先回应用户最后一句里最具体的那个词，不要用泛泛的共情开场。
- 以一到两张牌为主，写一个具体的画面、位置或正逆位细节；第三张只有在确实改变结论时，用一句话带过，不要三张平均分配，也不要背牌义。
- 先给出一个上文没有出现过的新区分，并把它作为主读法；再给一个能拆台的反读法；最后留一个尚未决定的地方。不要把几种可能平均铺开。
- 不要逐条给建议。最后只留一个问题或一个很小的观察邀请。
- 写成 2 到 4 个自然段，不用 Markdown，通常 ${lengthRule} 字；不必为了长而重复。`
  return [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    { role: 'user', content: context },
    ...history.slice(-MAX_CHAT_HISTORY).map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ]
}

export interface ReadingRequestOptions {
  onDelta?: StreamHandler
  signal?: AbortSignal
  lens?: ReadingLens
}

export function requestOpening(
  settings: Settings,
  question: string,
  cards: DrawnCard[],
  querent?: string,
  options: ReadingRequestOptions = {},
): Promise<string> {
  const messages: LlmMessage[] = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    { role: 'user', content: buildOpeningPrompt(question, cards, querent) },
  ]
  return options.onDelta
    ? streamChatCompletion(
        settings,
        messages,
        0.78,
        { signal: options.signal, maxTokens: 3000 },
        options.onDelta,
      )
    : chatCompletion(settings, messages, 0.78, {
        signal: options.signal,
        maxTokens: 3000,
      })
}

export function requestReply(
  settings: Settings,
  question: string,
  cards: DrawnCard[],
  history: ChatMessage[],
  options: ReadingRequestOptions = {},
): Promise<string> {
  const messages = buildReplyMessages(question, cards, history, options.lens)
  return options.onDelta
    ? streamChatCompletion(
        settings,
        messages,
        0.75,
        { signal: options.signal, maxTokens: 3000 },
        options.onDelta,
      )
    : chatCompletion(settings, messages, 0.75, {
        signal: options.signal,
        maxTokens: 3000,
      })
}

function parseInsight(raw: string): Insight {
  const cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new LlmError('自省记录的格式不对，再生成一次。')
  }
  let data: Record<string, unknown>
  try {
    data = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    throw new LlmError('自省记录的格式不对，再生成一次。')
  }
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  const mirror = typeof data.mirror === 'string' ? data.mirror.trim() : ''
  const pattern = typeof data.pattern === 'string' ? data.pattern.trim() : ''
  const invitation =
    typeof data.invitation === 'string' ? data.invitation.trim() : ''
  const keywords = Array.isArray(data.keywords)
    ? data.keywords
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 5)
    : []
  if (!title || !mirror) {
    throw new LlmError('自省记录缺少关键内容，再生成一次。')
  }
  return { title, mirror, pattern, invitation, keywords }
}

export async function requestInsight(
  settings: Settings,
  question: string,
  cards: DrawnCard[],
  messages: ChatMessage[],
  querent?: string,
): Promise<Insight> {
  const transcript = messages
    .slice(-30)
    .map((message) => `${message.role === 'user' ? '用户' : '月鉴'}：${message.content}`)
    .join('\n')
  const prompt = `你正在为用户整理一次塔罗自省记录。请阅读下面的牌面与对话，输出一个 JSON 对象，不要输出任何其他内容，不要使用代码块。

${buildCardContext(cards)}
${querent ? `\n这次牌阵是为「${querent}」展开的。` : ''}
用户的问题：「${question}」

对话记录：
${transcript}

JSON 字段要求：
{
  "title": "不超过 16 个字的记录标题，具体、不套路",
  "mirror": "一种可能的洞察，40-70 字。用“也许”“可能”或“像是”保留不确定，不预测未来",
  "pattern": "一种可能反复出现的模式或张力，50-90 字，不要写成确定诊断",
  "invitation": "一个温和、可执行的小邀请，30-60 字",
  "keywords": ["3-5 个关键词"]
}

要求：直接对用户说话，用“你”；不评判，不做诊断，不做预言；保留不确定性，语言具体，避免空洞的鸡汤。`

  const raw = await chatCompletion(
    settings,
    [
      { role: 'system', content: INSIGHT_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    0.45,
  )
  return parseInsight(raw)
}

export async function requestRevisitNote(
  settings: Settings,
  entry: JournalEntry,
  answer: string,
): Promise<string> {
  const prompt = `用户几天前做过一次塔罗自省。当时的记录：
问题：「${entry.question}」
洞察：「${entry.insight.mirror}」
模式：「${entry.insight.pattern}」
下一步邀请：「${entry.insight.invitation}」

现在用户回访，写下：「${answer}」

请你用 2-3 句话回应：先接住用户现在的状态，再轻轻指出这份回访里值得被看见的一点。不要复盘牌义，不预测，不评判，不使用 Markdown，不超过 100 字。`
  return chatCompletion(
    settings,
    [
      { role: 'system', content: REVISIT_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    0.7,
  )
}

export async function testConnection(
  settings: Settings,
): Promise<ConnectionCheckResult> {
  const started =
    typeof performance === 'undefined' ? Date.now() : performance.now()
  const endpoint = resolveEndpoint(settings)
  const model = effectiveModel(settings)
  const reply = await chatCompletion(
    settings,
    [
      {
        role: 'user',
        content: '这是一次连接测试，请只回复四个字：连接成功',
      },
    ],
    0.1,
    { maxTokens: 256, timeoutMs: 30000 },
  )
  const finished =
    typeof performance === 'undefined' ? Date.now() : performance.now()
  return {
    reply,
    latencyMs: Math.max(0, Math.round(finished - started)),
    endpoint,
    model,
    protocol: settings.apiProtocol,
  }
}
