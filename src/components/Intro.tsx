import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { MAJOR_ARCANA } from '../data/tarot'
import { isLitePerf } from '../lib/perf'
import { useFocusTrap } from '../lib/useFocusTrap'
import TarotCard from './TarotCard'

interface Props {
  onDone: () => void
}

type Stage = 'seed' | 'portal' | 'fan' | 'reveal' | 'ready'

const STAR_CARD = MAJOR_ARCANA.find((card) => card.id === 17) ?? MAJOR_ARCANA[0]
const RING_NUMERALS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
]

const polar = (radius: number, index: number, step: number) => {
  const angle = ((index * step - 90) * Math.PI) / 180
  return {
    x: 400 + Math.cos(angle) * radius,
    y: 400 + Math.sin(angle) * radius,
  }
}

const DIAL_TICKS = Array.from({ length: 120 }, (_, index) => {
  const major = index % 5 === 0
  const outer = polar(371, index, 3)
  const inner = polar(major ? 348 : 362, index, 3)
  return { index, major, outer, inner }
})

const DIAL_NUMERALS = RING_NUMERALS.map((glyph, index) => ({
  glyph,
  ...polar(334, index, 30),
}))

const DIAL_DIAMONDS = [45, 135, 225, 315].map((degree) => {
  const angle = ((degree - 90) * Math.PI) / 180
  return {
    x: 400 + Math.cos(angle) * 300,
    y: 400 + Math.sin(angle) * 300,
  }
})

function PortalDial() {
  return (
    <svg
      className="portal-dial-svg"
      viewBox="0 0 800 800"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="intro-rim"
          x1="92"
          y1="64"
          x2="710"
          y2="738"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#fbf1d8" stopOpacity="0.92" />
          <stop offset="0.24" stopColor="#d9b970" stopOpacity="0.42" />
          <stop offset="0.48" stopColor="#7d6135" stopOpacity="0.28" />
          <stop offset="0.74" stopColor="#f4dda6" stopOpacity="0.68" />
          <stop offset="1" stopColor="#67512e" stopOpacity="0.36" />
        </linearGradient>
        <path id="intro-arc-text" d="M 164 400 A 236 236 0 0 1 636 400" />
      </defs>

      <circle
        cx="400"
        cy="400"
        r="392"
        stroke="url(#intro-rim)"
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx="400"
        cy="400"
        r="384"
        stroke="#f4dda6"
        strokeOpacity="0.14"
        strokeWidth="0.7"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        className="dial-sweep"
        cx="400"
        cy="400"
        r="392"
        stroke="#f7e6bd"
        strokeOpacity="0.55"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="86 2378"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx="400"
        cy="400"
        r="375"
        stroke="#f4dda6"
        strokeOpacity="0.34"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeDasharray="0.1 17.6"
        vectorEffect="non-scaling-stroke"
      />

      {DIAL_TICKS.map(({ index, major, outer, inner }) => (
        <line
          key={index}
          x1={outer.x}
          y1={outer.y}
          x2={inner.x}
          y2={inner.y}
          stroke="#f4dda6"
          strokeOpacity={major ? 0.52 : 0.22}
          strokeWidth={major ? 1.1 : 0.7}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {DIAL_NUMERALS.map(({ glyph, x, y }) => (
        <text
          key={glyph}
          x={x}
          y={y}
          className="dial-numeral"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {glyph}
        </text>
      ))}

      <circle
        cx="400"
        cy="400"
        r="316"
        stroke="#d9b970"
        strokeOpacity="0.2"
        strokeWidth="0.8"
        strokeDasharray="352 144"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx="400"
        cy="400"
        r="308"
        stroke="#f4dda6"
        strokeOpacity="0.1"
        strokeWidth="0.7"
        strokeDasharray="2 14"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx="400"
        cy="400"
        r="291"
        stroke="#f4dda6"
        strokeOpacity="0.26"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeDasharray="0.1 30.5"
        vectorEffect="non-scaling-stroke"
      />

      {DIAL_DIAMONDS.map(({ x, y }) => (
        <path
          key={`${x}-${y}`}
          d="M 0 -6 L 3.2 0 L 0 6 L -3.2 0 Z"
          fill="#f4dda6"
          fillOpacity="0.55"
          transform={`translate(${x} ${y})`}
        />
      ))}

      <text className="dial-arc-text">
        <textPath href="#intro-arc-text" startOffset="50%" textAnchor="middle">
          LUNAR MIRROR · A QUIET PLACE
        </textPath>
      </text>

      <circle
        cx="400"
        cy="400"
        r="202"
        stroke="#f4dda6"
        strokeOpacity="0.22"
        strokeWidth="0.8"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx="400"
        cy="400"
        r="192"
        stroke="#d9b970"
        strokeOpacity="0.16"
        strokeWidth="0.7"
        strokeDasharray="1 7"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default function Intro({ onDone }: Props) {
  const [stage, setStage] = useState<Stage>('seed')
  const [leaving, setLeaving] = useState(false)
  const [peek, setPeek] = useState(false)
  const finishedRef = useRef(false)
  const timersRef = useRef<number[]>([])
  const trapRef = useFocusTrap<HTMLDivElement>(true)

  const cardCount = isLitePerf()
    ? 7
    : typeof window !== 'undefined' && window.innerWidth < 1024
      ? 9
      : 15
  const centerOffset = (cardCount - 1) / 2
  const offsets = Array.from(
    { length: cardCount },
    (_, index) => index - centerOffset,
  )

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    setLeaving(true)
    const timer = window.setTimeout(onDone, 900)
    timersRef.current.push(timer)
  }, [onDone])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish()
      return
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const schedule = (delay: number, action: () => void) => {
      timersRef.current.push(window.setTimeout(action, delay))
    }
    schedule(800, () => setStage('portal'))
    schedule(1500, () => setStage('fan'))
    schedule(3000, () => {
      setStage('reveal')
      setPeek(true)
    })
    schedule(4200, () => setStage('ready'))
    schedule(8000, finish)

    return () => {
      document.body.style.overflow = previousOverflow
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [finish])

  return (
    <div
      className={`intro stage-${stage} ${leaving ? 'is-leaving' : ''}`}
      ref={trapRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="月鉴开场"
      onClick={finish}
    >
      <div className="intro-atmosphere" aria-hidden="true">
        <span className="intro-nebula intro-nebula-a" />
        <span className="intro-nebula intro-nebula-b" />
        <span className="intro-nebula intro-nebula-c" />
        <span className="intro-beam" />
        <span className="intro-vignette" />
      </div>

      <span className="intro-seed-line" aria-hidden="true" />
      <span className="intro-seed-star" aria-hidden="true" />

      <div className="intro-portal" aria-hidden="true">
        <span className="portal-bloom" />
        <span className="portal-halo" />
        <span className="portal-orbit portal-orbit-a" />
        <span className="portal-orbit portal-orbit-b" />
        <div className="portal-dial">
          <PortalDial />
        </div>
        <div className="portal-core">
          <span className="portal-core-grooves" />
          <svg className="portal-sigil" viewBox="0 0 200 200" fill="none">
            <circle
              cx="100"
              cy="100"
              r="78"
              stroke="#f4dda6"
              strokeOpacity="0.22"
              strokeWidth="0.6"
              strokeDasharray="1 5"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="100"
              cy="100"
              r="56"
              stroke="#d9b970"
              strokeOpacity="0.18"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M100 22 L103.2 96.8 L178 100 L103.2 103.2 L100 178 L96.8 103.2 L22 100 L96.8 96.8 Z"
              stroke="#f4dda6"
              strokeOpacity="0.34"
              strokeWidth="0.6"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M100 46 L102.2 97.8 L154 100 L102.2 102.2 L100 154 L97.8 102.2 L46 100 L97.8 97.8 Z"
              transform="rotate(45 100 100)"
              stroke="#d9b970"
              strokeOpacity="0.24"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx="100" cy="100" r="1.6" fill="#f4dda6" fillOpacity="0.8" />
          </svg>
          <span className="portal-core-sheen" />
          <span className="portal-star portal-star-a" />
          <span className="portal-star portal-star-b" />
          <span className="portal-star portal-star-c" />
          <span className="portal-star portal-star-d" />
          <span className="portal-glint portal-glint-a" />
          <span className="portal-glint portal-glint-b" />
          <span className="portal-rim-light" />
        </div>
        <span className="portal-flare" />
        <span className="portal-seam" />
      </div>

      <div className="intro-stage">
        <div className="intro-fan" aria-hidden="true">
          {offsets.map((offset, index) => (
            <div
              className="intro-card"
              key={index}
              style={
                {
                  '--offset': offset,
                  '--abs': Math.abs(offset),
                  zIndex: 30 - Math.abs(offset),
                  transitionDelay: `${Math.abs(offset) * 55 + 120}ms`,
                } as CSSProperties
              }
            >
              <div
                className="intro-card-float"
                style={{ animationDelay: `${index * 0.22}s` }}
              >
                <TarotCard
                  card={offset === 0 ? STAR_CARD : undefined}
                  faceUp={offset === 0 && peek}
                  size="md"
                />
              </div>
            </div>
          ))}
          <span className="intro-shockwave" />
          <span className="intro-flare" />
        </div>

        <div className="intro-copy">
          <span className="intro-eyebrow">LUNAR MIRROR · 自省之镜</span>
          <h1 className="intro-title" aria-label="月鉴">
            <span style={{ '--i': 0 } as CSSProperties}>月</span>
            <span style={{ '--i': 1 } as CSSProperties}>鉴</span>
          </h1>
          <span className="intro-rule">
            <i />
          </span>
          <p className="intro-line">不是预言，是一面镜子</p>
          <button
            type="button"
            className="intro-enter"
            onClick={(event) => {
              event.stopPropagation()
              finish()
            }}
          >
            轻触进入
          </button>
        </div>
      </div>

      <button
        type="button"
        className="intro-skip"
        onClick={(event) => {
          event.stopPropagation()
          finish()
        }}
      >
        跳过
      </button>
      <span className="intro-footnote">A QUIET PLACE TO SEE YOURSELF</span>
      <span className="intro-progress" aria-hidden="true" />
    </div>
  )
}
