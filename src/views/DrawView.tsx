import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { buildChoicePile, toSpread, type PoolCard } from '../lib/draw'
import { playChime, playReveal, playShuffle } from '../lib/sound'
import type { DrawnCard } from '../types'
import { POSITION_ORDER, POSITIONS } from '../types'
import TarotCard from '../components/TarotCard'

interface Props {
  question: string
  querent?: string
  soundEnabled?: boolean
  onBack: () => void
  onComplete: (cards: DrawnCard[]) => void
}

function detectFanSize(): number {
  if (typeof window === 'undefined') return 13
  const width =
    document.documentElement?.clientWidth || window.innerWidth || 1440
  if (width < 480) return 7
  if (width < 760) return 11
  if (width < 1100) return 13
  return 15
}

const FAN_LABELS: Record<number, string> = {
  7: '七',
  9: '九',
  11: '十一',
  13: '十三',
  15: '十五',
}

export default function DrawView({
  question,
  querent,
  soundEnabled = false,
  onBack,
  onComplete,
}: Props) {
  const [fanSize, setFanSize] = useState(detectFanSize)
  const previousFanSize = useRef(fanSize)
  const center = (fanSize - 1) / 2
  const spreadAngle =
    fanSize >= 15 ? 62 : fanSize >= 13 ? 56 : fanSize >= 11 ? 50 : 46
  const angleStep = spreadAngle / (fanSize - 1)
  const [pile, setPile] = useState<PoolCard[]>(() => buildChoicePile(fanSize))
  const [picks, setPicks] = useState<number[]>([])
  const [revealedCount, setRevealedCount] = useState(0)
  const [shuffling, setShuffling] = useState(false)
  const [stage, setStage] = useState<'ritual' | 'shuffle' | 'ready'>('ritual')
  const ritualTimer = useRef<number | null>(null)
  const shuffleTimer = useRef<number | null>(null)
  const ritualRef = useRef(false)
  const shuffleRef = useRef(false)
  const fanZoneRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onResize = () => setFanSize(detectFanSize())
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [])

  useEffect(() => {
    if (previousFanSize.current === fanSize) return
    previousFanSize.current = fanSize
    if (shuffleTimer.current) {
      window.clearTimeout(shuffleTimer.current)
      shuffleTimer.current = null
    }
    shuffleRef.current = false
    setShuffling(false)
    setPicks([])
    setRevealedCount(0)
    setPile(buildChoicePile(fanSize))
  }, [fanSize])

  useEffect(() => {
    return () => {
      if (ritualTimer.current) window.clearTimeout(ritualTimer.current)
      if (shuffleTimer.current) window.clearTimeout(shuffleTimer.current)
    }
  }, [])

  useEffect(() => {
    if (stage !== 'ready') return
    const node = fanZoneRef.current
    if (!node) return
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    node.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'center',
    })
  }, [stage])

  const beginRitual = () => {
    if (stage !== 'ritual' || ritualRef.current) return
    ritualRef.current = true
    if (soundEnabled) playShuffle()
    setStage('shuffle')
    ritualTimer.current = window.setTimeout(() => setStage('ready'), 1200)
  }

  const skipRitual = () => {
    if (ritualTimer.current) window.clearTimeout(ritualTimer.current)
    ritualRef.current = false
    setStage('ready')
  }

  const spread = useMemo(
    () => picks.map((index) => pile[index]).filter(Boolean),
    [picks, pile],
  )
  const complete = spread.length === 3

  useEffect(() => {
    if (revealedCount >= picks.length) return
    const timer = window.setTimeout(() => setRevealedCount(picks.length), 140)
    return () => window.clearTimeout(timer)
  }, [picks.length, revealedCount])

  useEffect(() => {
    if (!complete || !soundEnabled) return
    playReveal()
  }, [complete, soundEnabled])

  const reshuffle = () => {
    if (shuffling || shuffleRef.current) return
    shuffleRef.current = true
    if (soundEnabled) playShuffle()
    setShuffling(true)
    setPicks([])
    setRevealedCount(0)
    shuffleTimer.current = window.setTimeout(() => {
      setPile(buildChoicePile(fanSize))
      shuffleRef.current = false
      setShuffling(false)
    }, 620)
  }

  const choose = (index: number) => {
    if (shuffling || complete || picks.includes(index)) return
    if (soundEnabled) playChime(picks.length)
    setPicks((previous) => {
      if (previous.length >= POSITION_ORDER.length || previous.includes(index)) {
        return previous
      }
      return [...previous, index]
    })
  }

  const tiltCard = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'mouse') return
    const node = event.currentTarget
    const rect = node.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    node.style.setProperty('--tilt-x', (0.5 - y).toFixed(3))
    node.style.setProperty('--tilt-y', (x - 0.5).toFixed(3))
    node.style.setProperty('--glare-x', `${(x * 100).toFixed(1)}%`)
    node.style.setProperty('--glare-y', `${(y * 100).toFixed(1)}%`)
  }

  const resetTilt = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.style.setProperty('--tilt-x', '0')
    event.currentTarget.style.setProperty('--tilt-y', '0')
  }

  const currentPosition = POSITION_ORDER[Math.min(picks.length, 2)]
  const currentCopy = POSITIONS[currentPosition]
  const activeSlot = complete ? -1 : picks.length

  return (
    <section className="view draw-view">
      <header className="stage-head">
        <button type="button" className="text-btn" onClick={onBack}>
          ← 重新提问
        </button>
        <div className="stage-question">
          <span className="eyebrow">
            {querent ? `为「${querent}」而开` : '你的问题'}
          </span>
          <p>{question}</p>
        </div>
        <span className="stage-spacer" />
      </header>

      {stage !== 'ready' ? (
        <div className={`ritual-stage ${stage === 'shuffle' ? 'is-shuffling' : ''}`}>
          <div className="ritual-halo" aria-hidden="true" />
          <div className="ritual-deck" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((index) => (
              <span
                className="ritual-deck-card"
                key={index}
                style={{ '--i': index } as CSSProperties}
              >
                <TarotCard size="sm" />
              </span>
            ))}
          </div>
          <span className="eyebrow">静心一息</span>
          <h2 className="ritual-title">
            {stage === 'shuffle'
              ? '牌正在洗开'
              : querent
                ? `为「${querent}」展开这副牌`
                : '先把问题放回心里'}
          </h2>
          <p className="ritual-text">
            {stage === 'shuffle'
              ? '让牌与问题一起，慢慢落位。'
              : '牌不急着回答。深呼吸一次，再看看三张牌想说什么。'}
          </p>
          <div className="ritual-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={beginRitual}
              disabled={stage === 'shuffle'}
            >
              {stage === 'shuffle' ? '洗牌中…' : '洗牌 · 展开牌扇'}
            </button>
            {stage !== 'shuffle' && (
              <button type="button" className="text-btn small" onClick={skipRitual}>
                直接选牌
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="draw-instructions">
            {complete ? (
              <p>三张牌都出现了。它们不是判决，只是三个可以对话的角度。</p>
            ) : (
              <p>
                深呼吸一次，凭直觉为「{currentCopy.label}」选一张牌
                <span className="draw-hint"> · {currentCopy.hint}</span>
              </p>
            )}
            <span className="draw-orientation-note">
              牌面会随机正位或逆位；逆位不是坏牌，只是同一个故事的另一种方向。
            </span>
          </div>

          <div className="spread-row">
        {POSITION_ORDER.map((position, index) => {
          const picked = picks[index] !== undefined ? pile[picks[index]] : null
          return (
            <div
              className={`spread-slot ${picked ? 'is-filled' : ''} ${index === activeSlot ? 'is-active' : ''}`}
              key={position}
            >
              <div className="slot-head">
                <span className="slot-index">{index + 1}</span>
                <span className="slot-label">{POSITIONS[position].label}</span>
                <em className="slot-hint">{POSITIONS[position].hint}</em>
              </div>
              {picked ? (
                <>
                  <div className={`slot-card ${index < revealedCount ? 'is-revealed' : ''}`}>
                    <TarotCard
                      card={picked.card}
                      orientation={picked.orientation}
                      faceUp={index < revealedCount}
                      size="md"
                    />
                  </div>
                  {index < revealedCount && (
                    <span className={`slot-orientation ${picked.orientation}`}>
                      {picked.orientation === 'upright' ? '↑ 正位' : '↓ 逆位'}
                    </span>
                  )}
                </>
              ) : (
                <div className="slot-placeholder">
                  <span className="placeholder-mark">✦</span>
                  <span>等待一张牌</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {complete && (
        <p className="draw-whisper">牌已入位。先让问题安静一会儿，再开始解读。</p>
      )}

      <div
        className={`fan-zone ${shuffling ? 'is-shuffling' : ''}`}
        ref={fanZoneRef}
      >
        <span className="fan-hint" aria-hidden="true">
          命运之扇 · 78 张 · {FAN_LABELS[fanSize] ?? '九'}选三
        </span>
        <div
          className="fan"
          role="group"
          aria-label={`从 ${fanSize} 张牌中选择一张`}
        >
          <span className="fan-arc" aria-hidden="true" />
          {pile.map((item, index) => {
            const isSelected = picks.includes(index)
            const orientation =
              item.orientation === 'upright' ? '正位' : '逆位'
            return (
              <button
                type="button"
                key={`${item.card.id}-${index}`}
                className={`fan-card ${isSelected ? 'is-picked' : ''}`}
                style={
                  {
                    '--rot': `${(index - center) * angleStep}deg`,
                    '--lift': `${Math.abs(index - center) ** 1.35 * 5.4}px`,
                    zIndex: index + 1,
                    '--delay': `${index * 55 + 120}ms`,
                  } as CSSProperties
                }
                onClick={() => choose(index)}
                onPointerMove={tiltCard}
                onPointerLeave={resetTilt}
                disabled={isSelected || complete}
                aria-pressed={isSelected}
                aria-label={
                  isSelected
                    ? `第 ${index + 1} 张牌，已选：${item.card.name} ${orientation}`
                    : `第 ${index + 1} 张牌，未选`
                }
              >
                <span className="fan-card-float">
                  <span className="fan-card-tilt">
                    <TarotCard size="sm" />
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="fan-actions">
          <button
            type="button"
            className="ghost-btn small"
            onClick={reshuffle}
            disabled={shuffling}
          >
            ⟳ 重新洗牌
          </button>
          <span className="fan-count">已选 {spread.length} / 3</span>
        </div>
      </div>

      <button
        type="button"
        className="primary-btn start-reading"
        onClick={() => onComplete(toSpread(spread))}
        disabled={!complete}
      >
        <span className="cta-star" aria-hidden="true">✦</span>
        <span>开始解读</span>
        <span className="cta-star" aria-hidden="true">✦</span>
      </button>
        </>
      )}
    </section>
  )
}
