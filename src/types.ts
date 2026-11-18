export type Orientation = 'upright' | 'reversed'

export type PositionKey = 'situation' | 'blindspot' | 'action'

export type ThemeKey =
  | 'work'
  | 'study'
  | 'grief'
  | 'family'
  | 'relation'
  | 'social'
  | 'money'
  | 'health'
  | 'pet'
  | 'creation'
  | 'dream'
  | 'spiritual'
  | 'life'
  | 'decision'
  | 'self'
  | 'other'

export interface TarotCard {
  id: number
  roman: string
  name: string
  nameEn: string
  symbol: string
  upright: { keywords: string[]; meaning: string }
  reversed: { keywords: string[]; meaning: string }
  prompts: [string, string]
}

export interface DrawnCard {
  card: TarotCard
  orientation: Orientation
  position: PositionKey
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  at: number
}

export interface Insight {
  title: string
  mirror: string
  pattern: string
  invitation: string
  keywords: string[]
  crisis?: boolean
}

export interface Revisit {
  at: number
  answer: string
  note: string
}

export interface JournalEntry {
  id: string
  createdAt: number
  question: string
  querent?: string
  cards: DrawnCard[]
  messages: ChatMessage[]
  insight: Insight
  snapshot?: string
  revisit?: Revisit
  revisits?: Revisit[]
}

export type ApiProtocol = 'openai' | 'anthropic' | 'gemini'

export type ThemeId = 'violet' | 'verdant' | 'abyss'

export interface ModelProfile {
  id: string
  apiProtocol: ApiProtocol
  apiBase: string
  model: string
  apiKey: string
}

export interface Settings {
  apiKey: string
  apiProtocol: ApiProtocol
  apiBase: string
  model: string
  modelHistory: Record<string, string[]>
  modelProfiles: ModelProfile[]
  activeProfileId: string | null
  voiceEnabled: boolean
  voiceURI: string
  soundEnabled: boolean
  bgmEnabled: boolean
  bgmVolume: number
  offline: boolean
  theme: ThemeId
}

export const POSITIONS: Record<
  PositionKey,
  { label: string; hint: string }
> = {
  situation: { label: '处境', hint: '此刻围绕你的' },
  blindspot: { label: '盲点', hint: '你不愿看见的' },
  action: { label: '行动', hint: '可以尝试的' },
}

export const POSITION_ORDER: PositionKey[] = [
  'situation',
  'blindspot',
  'action',
]
