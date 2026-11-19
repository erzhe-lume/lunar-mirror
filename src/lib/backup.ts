import type {
  ChatMessage,
  DrawnCard,
  Insight,
  JournalEntry,
  Orientation,
  PositionKey,
  Revisit,
  TarotCard,
} from '../types'

const POSITIONS: PositionKey[] = ['situation', 'blindspot', 'action']
const SNAPSHOT_LIMIT = 2_000_000

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

function textOf(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function stringsOf(value: unknown, max: number, length = 20): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, length))
    .filter(Boolean)
    .slice(0, max)
}

function timeOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}

function normalizeCardFace(value: unknown) {
  const face = recordOf(value)
  if (!face) return null
  const meaning = textOf(face.meaning, 4000)
  const keywords = stringsOf(face.keywords, 12)
  if (!meaning || keywords.length === 0) return null
  return { keywords, meaning }
}

function normalizeTarotCard(value: unknown): TarotCard | null {
  const card = recordOf(value)
  if (!card) return null
  const id = typeof card.id === 'number' ? card.id : NaN
  const name = textOf(card.name, 80)
  const upright = normalizeCardFace(card.upright)
  const reversed = normalizeCardFace(card.reversed)
  if (!Number.isFinite(id) || !name || !upright || !reversed) return null
  const prompts = Array.isArray(card.prompts)
    ? card.prompts
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 2)
        .map((item) => item.slice(0, 500))
    : []
  return {
    id,
    roman: textOf(card.roman, 20),
    name,
    nameEn: textOf(card.nameEn, 80),
    symbol: textOf(card.symbol, 12),
    upright,
    reversed,
    prompts: [prompts[0] ?? '', prompts[1] ?? ''],
  }
}

function normalizeDrawnCard(value: unknown): DrawnCard | null {
  const drawn = recordOf(value)
  if (!drawn) return null
  const card = normalizeTarotCard(drawn.card)
  const orientation = drawn.orientation
  const position = drawn.position
  if (!card) return null
  if (orientation !== 'upright' && orientation !== 'reversed') return null
  if (!POSITIONS.includes(position as PositionKey)) return null
  return {
    card,
    orientation: orientation as Orientation,
    position: position as PositionKey,
  }
}

function normalizeInsight(value: unknown): Insight | null {
  const insight = recordOf(value)
  if (!insight) return null
  const title = textOf(insight.title, 200)
  const mirror = textOf(insight.mirror, 4000)
  if (!title || !mirror) return null
  return {
    title,
    mirror,
    pattern: textOf(insight.pattern, 4000),
    invitation: textOf(insight.invitation, 4000),
    keywords: stringsOf(insight.keywords, 8, 40),
    crisis: insight.crisis === true ? true : undefined,
  }
}

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, 200)
    .map((item) => {
      const message = recordOf(item)
      if (!message) return null
      const content = textOf(message.content, 20000)
      const at = timeOf(message.at)
      if (!content || !at) return null
      if (message.role !== 'user' && message.role !== 'assistant') return null
      return { role: message.role, content, at } as ChatMessage
    })
    .filter((item): item is ChatMessage => Boolean(item))
}

function normalizeRevisits(
  revisitsValue: unknown,
  legacyValue: unknown,
): Revisit[] {
  const list = Array.isArray(revisitsValue)
    ? revisitsValue
    : legacyValue
      ? [legacyValue]
      : []
  return list
    .slice(0, 50)
    .map((item) => {
      const revisit = recordOf(item)
      if (!revisit) return null
      const at = timeOf(revisit.at)
      const answer = textOf(revisit.answer, 2000)
      const note = textOf(revisit.note, 4000)
      if (!at || !answer || !note) return null
      return { at, answer, note }
    })
    .filter((item): item is Revisit => Boolean(item))
}

function normalizeEntry(value: unknown): {
  entry: JournalEntry | null
  snapshotDropped: boolean
} {
  const raw = recordOf(value)
  if (!raw) return { entry: null, snapshotDropped: false }
  const id = textOf(raw.id, 120)
  const createdAt = timeOf(raw.createdAt)
  const question = textOf(raw.question, 2000)
  const insight = normalizeInsight(raw.insight)
  const cards = Array.isArray(raw.cards)
    ? raw.cards
        .slice(0, 3)
        .map(normalizeDrawnCard)
        .filter((item): item is DrawnCard => Boolean(item))
    : []
  if (!id || !createdAt || !question || !insight || cards.length !== 3) {
    return { entry: null, snapshotDropped: false }
  }
  const revisits = normalizeRevisits(raw.revisits, raw.revisit)
  const rawSnapshot = typeof raw.snapshot === 'string' ? raw.snapshot : ''
  const snapshot =
    /^data:image\/(?:png|jpeg|webp|gif);base64,/.test(rawSnapshot) &&
    rawSnapshot.length <= SNAPSHOT_LIMIT
      ? rawSnapshot
      : undefined
  const entry: JournalEntry = {
    id,
    createdAt,
    question,
    querent: textOf(raw.querent, 80) || undefined,
    cards,
    messages: normalizeMessages(raw.messages),
    insight,
    revisits: revisits.length > 0 ? revisits : undefined,
    snapshot,
  }
  return {
    entry,
    snapshotDropped: Boolean(rawSnapshot) && !snapshot,
  }
}

export interface BackupParseResult {
  entries: JournalEntry[]
  skipped: number
  snapshotsDropped: number
}

export function parseBackup(source: string): BackupParseResult {
  let data: unknown
  try {
    data = JSON.parse(source)
  } catch {
    throw new Error('这个文件不是有效的 JSON 备份。')
  }
  const list = Array.isArray(data)
    ? data
    : Array.isArray(recordOf(data)?.entries)
      ? (recordOf(data)?.entries as unknown[])
      : null
  if (!list) {
    throw new Error('备份里没有找到记录数组。')
  }

  const byId = new Map<string, JournalEntry>()
  let skipped = 0
  let snapshotsDropped = 0
  for (const item of list.slice(0, 5000)) {
    const result = normalizeEntry(item)
    if (!result.entry) {
      skipped += 1
      continue
    }
    if (result.snapshotDropped) snapshotsDropped += 1
    if (byId.has(result.entry.id)) skipped += 1
    byId.set(result.entry.id, result.entry)
  }
  return {
    entries: [...byId.values()].sort((a, b) => b.createdAt - a.createdAt),
    skipped,
    snapshotsDropped,
  }
}
