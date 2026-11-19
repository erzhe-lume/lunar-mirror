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

export class LlmError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmError'
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
}

export interface ConnectionCheckResult {
  reply: string
  latencyMs: number
  endpoint: string
  model: string
  protocol: ApiProtocol
}

type EndpointConfig = Pick<Settings, 'apiProtocol' | 'apiBase' | 'model'>

const MAX_CHAT_HISTORY = 24

const SAFETY_LINE = `如果用户提到自伤、伤害他人或严重心理危机，停止解牌，优先建议其联系现实中的紧急帮助（110/120 或当地急救）、心理援助热线和身边可信任的人。`

const CHAT_SYSTEM_PROMPT = `你是「月鉴」，一个塔罗自省陪伴者，不是预言家。你不预测未来，不替用户做决定，也不声称牌面拥有超自然力量。

写作方式：
1. 先用一两句话接住用户刚说的内容，再从牌面里挑一到两个意象，不要逐张解释三张牌。
2. 牌面不是判词。请同时保留两三种可能的读法，让它们并排存在，甚至彼此有一点矛盾；多用“也许”“可能”“我不确定”“也可以反过来看”。
3. 不要替用户断言他的内在状态，不写心理分析，不做诊断。把话停在“可能”的位置，比说准更重要。
4. 语言像安静的朋友，允许留白，也允许稍微绕一点；不堆砌术语，不用空洞鸡汤。
5. 不必每轮都以问题结尾。如果要提问，只问一个开放、具体的问题，不要为了提问硬加。
6. 中文，不用 Markdown。字数不必卡死：开场通常 250-450 字，追问通常 150-350 字，以把几种声音说清楚为准；不要为了短而变空，也不要为了长而注水。

${SAFETY_LINE}`

const INSIGHT_SYSTEM_PROMPT = `你是「月鉴」的记录整理者。你的任务是把一次塔罗自省对话整理成一条简洁、诚实、非预言式的记录。

只输出一个 JSON 对象，不要输出任何其他文字，不要使用 Markdown 或代码块。严格使用用户指定的字段和字数，不套用聊天时的提问规则或长度限制。直接对用户说话，用“你”；不评判、不做诊断、不预测未来。

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

  const content = extractContent(settings.apiProtocol, data).trim()
  if (!content) {
    throw new LlmError(
      `${PROTOCOL_LABEL[settings.apiProtocol]} 没有返回内容，请重试。`,
    )
  }
  return content
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

export function buildCardContext(cards: DrawnCard[]): string {
  const lines = cards.map((drawn, index) => {
    const position = POSITIONS[drawn.position]
    return `${index + 1}. ${position.label}（${position.hint}）：《${drawn.card.name}》${orientationLabel(drawn)}｜关键词：${cardKeywords(drawn).join('、')}｜牌义：${cardMeaning(drawn)}`
  })
  return `本次三张牌：\n${lines.join('\n')}`
}

function buildOpeningPrompt(
  question: string,
  cards: DrawnCard[],
  querent?: string,
): string {
  return `${buildCardContext(cards)}
${querent ? `\n这次牌阵是为「${querent}」展开的，请像面对这位问卜者一样说话。` : ''}
用户此刻的问题：「${question}」

请写这次开场：先用一两句话接住用户问出这个问题时的状态；再从三张牌里挑一到两个意象，贴着问题说，不要逐张报牌义，也不要把三张牌都解释一遍。不要给单一结论，可以同时留下两三种不完全一致的读法，让它们并排存在。语气像安静的朋友，不用模板，不用 Markdown。最后可以留一个开放问题，但不要为了提问而硬加。通常 250-450 字，不必压短。`
}

function buildReplyMessages(
  question: string,
  cards: DrawnCard[],
  history: ChatMessage[],
): LlmMessage[] {
  const context = `用户此刻的问题：「${question}」

${buildCardContext(cards)}

对话已进行到中段。不要重复开场，也不要逐张复述牌义。先回应用户最后一句，再给出一到两种可能的读法，让它们并存，不要急着收束成一个结论，也不要替用户断言他的感受。通常 150-350 字，可以稍长；如果要提问，只问一个开放问题，不要为了提问而硬加。不要使用 Markdown。`
  return [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    { role: 'user', content: context },
    ...history.slice(-MAX_CHAT_HISTORY).map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ]
}

export function requestOpening(
  settings: Settings,
  question: string,
  cards: DrawnCard[],
  querent?: string,
): Promise<string> {
  return chatCompletion(
    settings,
    [
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      { role: 'user', content: buildOpeningPrompt(question, cards, querent) },
    ],
    0.78,
  )
}

export function requestReply(
  settings: Settings,
  question: string,
  cards: DrawnCard[],
  history: ChatMessage[],
): Promise<string> {
  return chatCompletion(
    settings,
    buildReplyMessages(question, cards, history),
    0.75,
  )
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
