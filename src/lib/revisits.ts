import type { JournalEntry, Revisit } from '../types'

const DAY = 86400000

export const REVISIT_DUE_DAYS = 7
export const REVISIT_LONG_DAYS = 30

export function revisitsOf(
  entry: Pick<JournalEntry, 'revisit' | 'revisits'>,
): Revisit[] {
  if (entry.revisits?.length) return entry.revisits
  return entry.revisit ? [entry.revisit] : []
}

export interface DueRevisit {
  entry: JournalEntry
  days: number
  lastAt: number
  level: 'week' | 'long'
}

export function dueRevisits(
  entries: JournalEntry[],
  now: number,
): DueRevisit[] {
  return entries
    .filter((entry) => !entry.insight.crisis)
    .map((entry) => {
      const revisits = revisitsOf(entry)
      const lastAt = Math.max(
        entry.createdAt,
        ...revisits.map((revisit) => revisit.at),
      )
      const days = Math.floor((now - lastAt) / DAY)
      return {
        entry,
        days,
        lastAt,
        level: days >= REVISIT_LONG_DAYS ? ('long' as const) : ('week' as const),
      }
    })
    .filter((item) => item.days >= REVISIT_DUE_DAYS)
    .sort((left, right) => left.lastAt - right.lastAt)
}
