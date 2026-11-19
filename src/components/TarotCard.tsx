import type { CSSProperties } from 'react'
import type { Orientation, TarotCard as TarotCardData } from '../types'
import CardBackArt from './CardBackArt'

interface Props {
  card?: TarotCardData
  orientation?: Orientation
  faceUp?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  style?: CSSProperties
}

export default function TarotCard({
  card,
  orientation = 'upright',
  faceUp = false,
  size = 'md',
  className = '',
  style,
}: Props) {
  const showFront = Boolean(card) && faceUp
  const keywords = card
    ? orientation === 'upright'
      ? card.upright.keywords
      : card.reversed.keywords
    : []

  return (
    <div
      className={`tarot-card tarot-${size} ${showFront ? 'is-up' : ''} ${className}`}
      style={style}
      aria-hidden={!showFront}
    >
      <div className="tarot-inner">
        <div className="tarot-side tarot-back">
          <CardBackArt />
          <span className="back-glow" aria-hidden="true" />
        </div>
        <div className="tarot-side tarot-front">
          {card && (
            <div className="card-frame">
              <span className="card-halo" aria-hidden="true" />
              <span className="card-arch" aria-hidden="true" />
              <span className="card-corner corner-tl">✦</span>
              <span className="card-corner corner-tr">✦</span>
              <span className="card-corner corner-bl">✦</span>
              <span className="card-corner corner-br">✦</span>
              <span className="card-numeral">
                <span>{card.roman}</span>
              </span>
              <span
                className={`card-emblem ${orientation === 'reversed' ? 'is-reversed' : ''}`}
              >
                {card.symbol}
              </span>
              <span className="card-name">{card.name}</span>
              <span className="card-en">{card.nameEn}</span>
              <span className="card-rule">
                <i />
              </span>
              <span className="card-keywords">{keywords.slice(0, 3).join(' · ')}</span>
              <span className="card-brand">LUNAR MIRROR</span>
              <span className={`card-badge ${orientation}`}>
                {orientation === 'upright' ? '↑ 正位' : '↓ 逆位'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
