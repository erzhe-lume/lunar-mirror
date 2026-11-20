import { PRIVATE_IMAGES, type PrivateImage } from '../data/private-images'
import type { JournalEntry, PrivateCard, TarotCard } from '../types'

const PRIVATE_KEY = 'lunar-mirror.private-card'
const PRIVATE_ID = 79
const ELIGIBLE_ENTRIES = 3
export const PRIVATE_DRAW_CHANCE = 0.18

function usableEntries(entries: JournalEntry[]): JournalEntry[] {
  return entries.filter((entry) => !entry.insight.crisis)
}

export function privateCardSources(entries: JournalEntry[]): JournalEntry[] {
  return usableEntries(entries).slice(0, ELIGIBLE_ENTRIES)
}

export function privateCardEligible(entries: JournalEntry[]): boolean {
  return usableEntries(entries).length >= ELIGIBLE_ENTRIES
}

function hash(value: string): number {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function sourceText(entries: JournalEntry[]): string {
  return privateCardSources(entries)
    .flatMap((entry) => [
      entry.question,
      ...entry.messages
        .filter((message) => message.role === 'user')
        .slice(-8)
        .map((message) => message.content),
      entry.insight.title,
      entry.insight.mirror,
      entry.insight.pattern,
      entry.insight.invitation,
      ...entry.insight.keywords,
    ])
    .join(' ')
}

export function buildPrivateCandidates(
  entries: JournalEntry[],
  round = 0,
): PrivateImage[] {
  const text = sourceText(entries)
  const seed = hash(`${text}:${round}`)
  const ranked = PRIVATE_IMAGES.map((image) => ({
    image,
    score: image.triggers.reduce(
      (total, trigger) => total + (text.includes(trigger) ? 1 : 0),
      0,
    ),
    tie: hash(`${image.id}:${seed}`),
  })).sort((a, b) => b.score - a.score || a.tie - b.tie)

  const chosen: PrivateImage[] = []
  for (const item of ranked) {
    if (chosen.length >= 3) break
    if (item.score > 0) chosen.push(item.image)
  }

  const start = seed % PRIVATE_IMAGES.length
  for (let offset = 0; chosen.length < 3 && offset < PRIVATE_IMAGES.length; offset += 1) {
    const image = PRIVATE_IMAGES[(start + round * 3 + offset) % PRIVATE_IMAGES.length]
    if (!chosen.some((item) => item.id === image.id)) chosen.push(image)
  }
  return chosen.slice(0, 3)
}

export function privateCardImage(imageId: string): PrivateImage | null {
  return PRIVATE_IMAGES.find((image) => image.id === imageId) ?? null
}

export function createPrivateCard(
  image: PrivateImage,
  name: string,
  entries: JournalEntry[],
): PrivateCard {
  const clean = name.trim().slice(0, 10) || image.name
  return {
    id:
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `private-${Date.now()}`,
    name: clean,
    nameEn: 'YOUR 79TH',
    symbol: image.symbol,
    keywords: [...image.keywords],
    prompt: image.prompt,
    imageId: image.id,
    createdAt: Date.now(),
    sourceEntryIds: privateCardSources(entries).map((entry) => entry.id),
    pending: true,
  }
}

export function privateCardToTarotCard(card: PrivateCard): TarotCard {
  return {
    id: PRIVATE_ID,
    roman: '79',
    name: card.name,
    nameEn: card.nameEn,
    symbol: card.symbol,
    upright: { keywords: [...card.keywords], meaning: card.prompt },
    reversed: { keywords: [...card.keywords], meaning: card.prompt },
    prompts: [card.prompt, ''],
    private: true,
    privateImageId: card.imageId,
  }
}

export function shouldIncludePrivate(card: PrivateCard | null): boolean {
  if (!card) return false
  return card.pending || Math.random() < PRIVATE_DRAW_CHANCE
}

export function normalizePrivateCard(value: unknown): PrivateCard | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const name =
    typeof record.name === 'string' ? record.name.trim().slice(0, 24) : ''
  const prompt =
    typeof record.prompt === 'string' ? record.prompt.trim().slice(0, 200) : ''
  const imageId =
    typeof record.imageId === 'string' ? record.imageId.trim().slice(0, 80) : ''
  const symbol =
    typeof record.symbol === 'string' ? record.symbol.trim().slice(0, 12) : ''
  const nameEn =
    typeof record.nameEn === 'string' ? record.nameEn.trim().slice(0, 80) : ''
  const createdAt =
    typeof record.createdAt === 'number' && record.createdAt > 0
      ? record.createdAt
      : 0
  const keywords = Array.isArray(record.keywords)
    ? record.keywords
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().slice(0, 24))
        .filter(Boolean)
        .slice(0, 3)
    : []
  if (!name || !prompt || !imageId || !symbol || !createdAt || keywords.length === 0) {
    return null
  }
  const padded = [...keywords]
  while (padded.length < 3) padded.push('此刻')
  return {
    id:
      typeof record.id === 'string' && record.id.trim()
        ? record.id
        : `private-${createdAt}`,
    name,
    nameEn: nameEn || 'YOUR 79TH',
    symbol,
    keywords: padded,
    prompt,
    imageId,
    createdAt,
    sourceEntryIds: Array.isArray(record.sourceEntryIds)
      ? record.sourceEntryIds
          .filter((item): item is string => typeof item === 'string')
          .slice(0, 6)
      : [],
    pending: record.pending === true,
  }
}

export function loadPrivateCard(): PrivateCard | null {
  try {
    const raw = localStorage.getItem(PRIVATE_KEY)
    if (!raw) return null
    return normalizePrivateCard(JSON.parse(raw))
  } catch {
    return null
  }
}

export function savePrivateCard(card: PrivateCard): boolean {
  try {
    localStorage.setItem(PRIVATE_KEY, JSON.stringify(card))
    return true
  } catch {
    return false
  }
}

export function clearPrivateCard(): void {
  try {
    localStorage.removeItem(PRIVATE_KEY)
  } catch {
    // Nothing else to clear.
  }
}
