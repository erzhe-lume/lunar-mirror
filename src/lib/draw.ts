import { ALL_CARDS } from '../data/tarot'
import { POSITION_ORDER } from '../types'
import type { DrawnCard, Orientation, PrivateCard, TarotCard } from '../types'
import { privateCardToTarotCard } from './private-card'

export interface PoolCard {
  card: TarotCard
  orientation: Orientation
  private?: boolean
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function buildChoicePile(
  size = 7,
  privateCard?: PrivateCard | null,
): PoolCard[] {
  const pile: PoolCard[] = shuffle(ALL_CARDS)
    .slice(0, size)
    .map((card) => ({
      card,
      orientation: (Math.random() < 0.5 ? 'reversed' : 'upright') as Orientation,
    }))
  if (privateCard && pile.length > 0) {
    const at = Math.floor(Math.random() * pile.length)
    pile[at] = {
      card: privateCardToTarotCard(privateCard),
      orientation: 'upright',
      private: true,
    }
  }
  return pile
}

export function toSpread(picks: PoolCard[]): DrawnCard[] {
  return picks.slice(0, POSITION_ORDER.length).map((pick, index) => ({
    card: pick.card,
    orientation: pick.orientation,
    position: POSITION_ORDER[index],
  }))
}
