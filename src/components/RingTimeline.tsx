import type { CSSProperties } from 'react'
import type { JournalEntry } from '../types'
import { formatDate, formatShortDate } from '../lib/format'
import { revisitsOf } from '../lib/revisits'
import TarotCard from './TarotCard'

export const RING_PAGE_SIZE = 5

interface Props {
  entries: JournalEntry[]
  page: number
  previewId: string | null
  onPageChange: (page: number) => void
  onPreview: (id: string) => void
  onOpen: (entry: JournalEntry) => void
}

function arcAngles(count: number): number[] {
  if (count <= 1) return [0]
  const span = count === 2 ? 54 : count === 3 ? 86 : count === 4 ? 102 : 112
  return Array.from(
    { length: count },
    (_, index) => -span / 2 + (span * index) / (count - 1),
  )
}

function drawnKeywords(drawn: JournalEntry['cards'][number]): string[] {
  return drawn.orientation === 'upright'
    ? drawn.card.upright.keywords
    : drawn.card.reversed.keywords
}

function pickRepresentative(entry: JournalEntry) {
  const cards = entry.cards
  if (cards.length === 0) return null
  const insightWords = new Set(entry.insight.keywords)
  let best = cards[Math.min(2, cards.length - 1)]
  let bestScore = -1
  cards.forEach((drawn) => {
    const score = drawnKeywords(drawn).filter((word) =>
      insightWords.has(word),
    ).length
    if (score > bestScore) {
      best = drawn
      bestScore = score
    }
  })
  return best
}

export default function RingTimeline({
  entries,
  page,
  previewId,
  onPageChange,
  onPreview,
  onOpen,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(entries.length / RING_PAGE_SIZE))
  const safePage = Math.min(Math.max(page, 0), pageCount - 1)
  const visible = entries.slice(
    safePage * RING_PAGE_SIZE,
    safePage * RING_PAGE_SIZE + RING_PAGE_SIZE,
  )
  const preview =
    visible.find((entry) => entry.id === previewId) ?? visible[0]
  const representative = preview ? pickRepresentative(preview) : null
  const angles = arcAngles(visible.length)

  return (
    <div className="ring-timeline">
      <div className="ring-stage">
        <span className="ring-halo" aria-hidden="true" />
        <div className="thread-ring">
          <span className="ring-beads" aria-hidden="true" />
          <span className="ring-orbit" aria-hidden="true" />
          <span className="ring-heart" aria-hidden="true">♡</span>

          {preview && (
            <button
              key={preview.id}
              type="button"
              className="ring-ritual"
              onClick={() => onOpen(preview)}
              aria-label={`打开时间线记录：${preview.question}`}
              title={preview.question}
            >
              <span className="ring-ritual-plate" aria-hidden="true" />
              <span className="ring-ritual-label">本次牌阵</span>
              {preview.insight.crisis || !representative ? (
                <span className="ring-ritual-crisis">
                  此刻先不解读牌面
                </span>
              ) : (
                <span className="ring-deck" aria-hidden="true">
                  {Array.from({ length: 4 }, (_, index) => (
                    <span
                      className={`ring-deck-card back-${index + 1}`}
                      key={index}
                    >
                      <TarotCard size="sm" />
                    </span>
                  ))}
                  <span className="ring-deck-card face">
                    <TarotCard
                      card={representative.card}
                      orientation={representative.orientation}
                      faceUp
                      size="sm"
                    />
                  </span>
                </span>
              )}
              <span className="ring-ritual-meta">
                {formatShortDate(preview.createdAt)}
                {preview.insight.keywords[0]
                  ? ` · ${preview.insight.keywords[0]}`
                  : ''}
              </span>
              <span className="ring-ritual-enter">
                点开这次照见 <i>→</i>
              </span>
            </button>
          )}

          <ol className="thread-charms" aria-label="时间线上的照见">
            {visible.map((entry, index) => {
              const angle = (angles[index] * Math.PI) / 180
              const x = 50 + 46 * Math.sin(angle)
              const y = 50 + 46 * Math.cos(angle)
              const selected = preview?.id === entry.id
              return (
                <li
                  key={entry.id}
                  className={`thread-item ${selected ? 'is-selected' : ''}`}
                  style={
                    {
                      '--x': `${x}%`,
                      '--y': `${y}%`,
                      '--z': selected ? 35 : 10 + index,
                    } as CSSProperties
                  }
                >
                  <span className="thread-knot" aria-hidden="true" />
                  <span className="thread-line" aria-hidden="true" />
                  <button
                    type="button"
                    className={`thread-charm ${selected ? 'is-selected' : ''}`}
                    onClick={() => onPreview(entry.id)}
                    aria-pressed={selected}
                    aria-label={`预览 ${formatDate(entry.createdAt)}：${entry.question}`}
                  >
                    <span className="charm-star" aria-hidden="true">✦</span>
                    <span className="charm-date">
                      {formatShortDate(entry.createdAt)}
                    </span>
                    <span className="charm-name">
                      {entry.insight.keywords[0]?.trim() ||
                        entry.cards[0]?.card.name ||
                        '照见'}
                    </span>
                    {!entry.insight.crisis && (
                      <span className="charm-pips" aria-hidden="true">
                        {entry.cards.map((drawn) => (
                          <i
                            key={drawn.position}
                            className={drawn.orientation}
                          />
                        ))}
                      </span>
                    )}
                    {revisitsOf(entry).length > 0 && (
                      <span className="charm-revisit" aria-hidden="true">✧</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      {pageCount > 1 && (
        <div className="ring-pager">
          <button
            type="button"
            className="ring-page-btn"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage === 0}
          >
            ← 较近
          </button>
          <span>
            {safePage + 1} / {pageCount}
          </span>
          <button
            type="button"
            className="ring-page-btn"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage === pageCount - 1}
          >
            更早 →
          </button>
        </div>
      )}

      <p className="ring-hint">轻点星卡切换预览，点开中央牌阵进入记录</p>
    </div>
  )
}
