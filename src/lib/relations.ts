import type { DrawnCard } from '../types'

export type RelationKind = 'shared' | 'opposite'

export interface CardRelation {
  from: number
  to: number
  kind: RelationKind
  label: string
}

const SKIP_WORDS = new Set(['此刻', '变化', '选择', '自省', '关系', '问题', '答案', '自己'])

const OPPOSITES: [string, string][] = [
  ['靠近', '退后'],
  ['表达', '沉默'],
  ['行动', '等待'],
  ['控制', '放手'],
  ['留下', '离开'],
  ['开始', '结束'],
  ['得到', '失去'],
  ['理性', '情感'],
  ['安全', '冒险'],
  ['坚持', '放弃'],
  ['打开', '关上'],
  ['相信', '怀疑'],
  ['自由', '束缚'],
  ['想要', '应该'],
  ['说话', '沉默'],
  ['前进', '后退'],
]

function keywordsOf(drawn: DrawnCard): string[] {
  if (drawn.card.private) return drawn.card.upright.keywords
  return drawn.orientation === 'upright'
    ? drawn.card.upright.keywords
    : drawn.card.reversed.keywords
}

function normalize(word: string): string {
  return word.replace(/[\s，。；、,.!?！？：:]/g, '')
}

function pairRelation(a: DrawnCard, b: DrawnCard, from: number, to: number): CardRelation | null {
  const aWords = keywordsOf(a).map(normalize).filter(Boolean)
  const bWords = keywordsOf(b).map(normalize).filter(Boolean)
  const shared = aWords.find(
    (word) => word.length >= 2 && !SKIP_WORDS.has(word) && bWords.includes(word),
  )
  if (shared) {
    return { from, to, kind: 'shared', label: `共词 · ${shared}` }
  }
  for (const [left, right] of OPPOSITES) {
    const aLeft = aWords.some((word) => word.includes(left))
    const aRight = aWords.some((word) => word.includes(right))
    const bLeft = bWords.some((word) => word.includes(left))
    const bRight = bWords.some((word) => word.includes(right))
    if ((aLeft && bRight) || (aRight && bLeft)) {
      return {
        from,
        to,
        kind: 'opposite',
        label: `相反 · ${left} ↔ ${right}`,
      }
    }
  }
  return null
}

export function buildCardRelations(cards: DrawnCard[]): CardRelation[] {
  const relations: CardRelation[] = []
  for (let from = 0; from < cards.length; from += 1) {
    for (let to = from + 1; to < cards.length; to += 1) {
      const relation = pairRelation(cards[from], cards[to], from, to)
      if (relation) relations.push(relation)
    }
  }
  return relations
    .sort((a, b) => Math.abs(a.from - a.to) - Math.abs(b.from - b.to))
    .slice(0, 2)
}
