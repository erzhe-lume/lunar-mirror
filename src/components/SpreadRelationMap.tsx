import type { DrawnCard } from '../types'
import { POSITIONS } from '../types'
import { buildCardRelations, type CardRelation } from '../lib/relations'

interface Props {
  cards: DrawnCard[]
  compact?: boolean
}

function edgePath(relation: CardRelation): string {
  if (relation.to - relation.from === 1) {
    const x1 = 40 + relation.from * 110
    const x2 = 40 + relation.to * 110
    return `M${x1} 52 L${x2} 52`
  }
  return 'M40 52 Q150 12 260 52'
}

export default function SpreadRelationMap({ cards, compact = false }: Props) {
  const relations = buildCardRelations(cards)
  if (cards.length !== 3) return null

  return (
    <section
      className={`spread-map ${compact ? 'is-compact' : ''}`}
      aria-label="三张牌的关系"
    >
      <div className="spread-map-head">
        <span className="eyebrow">牌阵关系</span>
        <span>共词 · 相反</span>
      </div>
      <svg
        className="spread-map-svg"
        viewBox="0 0 300 108"
        role="img"
        aria-label={
          relations.length > 0
            ? relations.map((relation) => relation.label).join('，')
            : '三张牌没有直接的共词或反向关系'
        }
      >
        <path
          className="spread-map-base"
          d="M40 52 L150 52 L260 52"
          fill="none"
        />
        {relations.map((relation, index) => (
          <g key={`${relation.from}-${relation.to}-${index}`}>
            <path
              className={`spread-map-edge is-${relation.kind}`}
              d={edgePath(relation)}
              fill="none"
            />
            <text
              className="spread-map-edge-label"
              x={relation.to - relation.from === 1 ? 95 + relation.from * 110 : 150}
              y={relation.to - relation.from === 1 ? 45 : 20}
              textAnchor="middle"
            >
              {relation.label}
            </text>
          </g>
        ))}
        {cards.map((drawn, index) => (
          <g key={drawn.position} className="spread-map-node">
            <circle
              className={drawn.card.private ? 'is-private' : ''}
              cx={40 + index * 110}
              cy="52"
              r="17"
            />
            <text
              className="spread-map-index"
              x={40 + index * 110}
              y="56"
              textAnchor="middle"
            >
              {drawn.card.private ? '79' : String(index + 1)}
            </text>
            <text
              className="spread-map-label"
              x={40 + index * 110}
              y="86"
              textAnchor="middle"
            >
              {POSITIONS[drawn.position].label}
            </text>
            <text
              className="spread-map-name"
              x={40 + index * 110}
              y="100"
              textAnchor="middle"
            >
              {drawn.card.name.length > 7
                ? `${drawn.card.name.slice(0, 7)}…`
                : drawn.card.name}
            </text>
          </g>
        ))}
      </svg>
      <div className="spread-map-legend">
        {relations.length > 0 ? (
          relations.map((relation, index) => (
            <span key={`${relation.label}-${index}`}>
              {POSITIONS[cards[relation.from].position].label} ×{' '}
              {POSITIONS[cards[relation.to].position].label} · {relation.label}
            </span>
          ))
        ) : (
          <span>没有直接的共词或反向关系；位置本身仍是一条线。</span>
        )}
      </div>
    </section>
  )
}
