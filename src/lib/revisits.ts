import type { JournalEntry, Revisit } from '../types'

export function revisitsOf(
  entry: Pick<JournalEntry, 'revisit' | 'revisits'>,
): Revisit[] {
  if (entry.revisits?.length) return entry.revisits
  return entry.revisit ? [entry.revisit] : []
}
