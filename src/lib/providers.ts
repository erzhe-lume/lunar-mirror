import type { ApiProtocol } from '../types'

export interface ProtocolOption {
  id: ApiProtocol
  label: string
  caption: string
  hint: string
}

export interface ProviderPreset {
  id: string
  label: string
  protocol: ApiProtocol
  base: string
  models: string[]
  keyPlaceholder: string
}

const readEnv = (value: string | undefined, fallback: string) =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback

const QWEN_BASE = readEnv(import.meta.env.VITE_QWEN_BASE, '/api/qwen')
const OPENAI_BASE = readEnv(import.meta.env.VITE_OPENAI_BASE, '/api/openai')
const ANTHROPIC_BASE = readEnv(
  import.meta.env.VITE_ANTHROPIC_BASE,
  '/api/anthropic',
)
const GEMINI_BASE = readEnv(import.meta.env.VITE_GEMINI_BASE, '/api/gemini')
const DEEPSEEK_BASE = readEnv(
  import.meta.env.VITE_DEEPSEEK_BASE,
  '/api/deepseek',
)

export const API_PROTOCOLS: ProtocolOption[] = [
  {
    id: 'openai',
    label: 'OpenAI 兼容',
    caption: 'Chat Completions',
    hint: '覆盖千问、DeepSeek、Kimi、OpenRouter 与多数网关。',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    caption: 'Messages',
    hint: 'Claude 官方 Messages 协议，也适用于支持该协议的网关。',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    caption: 'generateContent',
    hint: 'Google Gemini 官方协议，适合直连 Gemini 或对应网关。',
  },
]

export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'qwen',
    label: '千问',
    protocol: 'openai',
    base: QWEN_BASE,
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max'],
    keyPlaceholder: 'DashScope API Key',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai',
    base: OPENAI_BASE,
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'claude',
    label: 'Claude',
    protocol: 'anthropic',
    base: ANTHROPIC_BASE,
    models: ['claude-sonnet-4-5', 'claude-haiku-4-5'],
    keyPlaceholder: 'sk-ant-...',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    protocol: 'gemini',
    base: GEMINI_BASE,
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    keyPlaceholder: 'Google AI Studio API Key',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai',
    base: DEEPSEEK_BASE,
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyPlaceholder: 'DeepSeek API Key',
  },
]

export const PROTOCOL_LABEL: Record<ApiProtocol, string> = {
  openai: 'OpenAI 兼容',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
}

const PROTOCOL_DEFAULT_BASE: Record<ApiProtocol, string> = {
  openai: OPENAI_BASE,
  anthropic: ANTHROPIC_BASE,
  gemini: GEMINI_BASE,
}

const PROTOCOL_DEFAULT_MODEL: Record<ApiProtocol, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-5',
  gemini: 'gemini-2.5-flash',
}

export const DEFAULT_PROVIDER = PROVIDERS[0]

export function normalizeBase(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

export function modelHistoryKey(
  protocol: ApiProtocol,
  base: string,
): string {
  return `${protocol}::${normalizeBase(base) || defaultBaseFor(protocol)}`
}

export function findProvider(
  protocol: ApiProtocol,
  base: string,
): ProviderPreset | undefined {
  const normalized = normalizeBase(base)
  return PROVIDERS.find(
    (provider) =>
      provider.protocol === protocol &&
      normalizeBase(provider.base) === normalized,
  )
}

export function defaultBaseFor(protocol: ApiProtocol): string {
  return PROTOCOL_DEFAULT_BASE[protocol]
}

export function defaultModelFor(
  protocol: ApiProtocol,
  base = '',
): string {
  return findProvider(protocol, base)?.models[0] ?? PROTOCOL_DEFAULT_MODEL[protocol]
}

export function modelsFor(
  protocol: ApiProtocol,
  base: string,
): string[] {
  const provider = findProvider(protocol, base)
  if (provider) return provider.models
  return PROVIDERS.filter((item) => item.protocol === protocol).flatMap(
    (item) => item.models,
  )
}

export function providerLabel(
  protocol: ApiProtocol,
  base: string,
): string {
  return findProvider(protocol, base)?.label ?? '自定义网关'
}
