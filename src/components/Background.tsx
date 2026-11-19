import { useEffect, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import { isLitePerf } from '../lib/perf'

interface Star {
  left: number
  top: number
  size: number
  delay: number
  duration: number
  opacity: number
}

interface Dust {
  left: number
  top: number
  size: number
  delay: number
  duration: number
  dx: number
  dy: number
  opacity: number
}

const mandalaTicks = Array.from({ length: 120 }, (_, index) => {
  const angle = (index / 120) * Math.PI * 2
  const major = index % 10 === 0
  const inner = major ? 342 : 354
  return {
    key: index,
    x1: 400 + Math.cos(angle) * inner,
    y1: 400 + Math.sin(angle) * inner,
    x2: 400 + Math.cos(angle) * 366,
    y2: 400 + Math.sin(angle) * 366,
    major,
  }
})

const mandalaMarks = Array.from({ length: 12 }, (_, index) => {
  const angle = (index / 12) * Math.PI * 2 - Math.PI / 2
  return {
    key: index,
    x: 400 + Math.cos(angle) * 306,
    y: 400 + Math.sin(angle) * 306,
  }
})

function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const constellationGroups = [
  {
    points: [
      [140, 180],
      [240, 140],
      [330, 210],
      [410, 150],
      [520, 240],
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [2, 4],
    ],
  },
  {
    points: [
      [1180, 320],
      [1250, 260],
      [1320, 360],
      [1400, 300],
      [1280, 430],
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
    ],
  },
  {
    points: [
      [640, 760],
      [720, 700],
      [800, 780],
      [900, 720],
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
  },
]

export default function Background() {
  const lite = useMemo(() => isLitePerf(), [])
  const stars = useMemo<Star[]>(() => {
    const random = seededRandom(lite ? 19 : 71)
    return Array.from({ length: lite ? 30 : 110 }, () => ({
      left: random() * 100,
      top: random() * 100,
      size: random() * 1.8 + 0.8,
      delay: random() * 6,
      duration: random() * 5 + 3,
      opacity: random() * 0.5 + 0.2,
    }))
  }, [lite])
  const dust = useMemo<Dust[]>(() => {
    if (lite) return []
    const random = seededRandom(23)
    return Array.from({ length: 26 }, () => ({
      left: random() * 100,
      top: random() * 100,
      size: random() * 2.2 + 1,
      delay: random() * 9,
      duration: random() * 8 + 9,
      dx: (random() - 0.5) * 46,
      dy: (random() - 0.5) * 70 - 22,
      opacity: random() * 0.45 + 0.15,
    }))
  }, [lite])
  const cursorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (lite || window.matchMedia('(pointer: coarse)').matches) return
    let frame = 0
    const onMove = (event: PointerEvent) => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const node = cursorRef.current
        if (!node) return
        node.style.transform = `translate3d(${event.clientX - 320}px, ${event.clientY - 320}px, 0)`
      })
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [lite])

  if (lite) {
    return (
      <div className="sky sky-lite" aria-hidden="true">
        <div className="sky-lite-aurora" />
        <span className="sky-moon" />
        <svg className="sky-lite-ring" viewBox="0 0 800 800" fill="none">
          <circle
            cx="400"
            cy="400"
            r="382"
            stroke="currentColor"
            strokeWidth="0.6"
            opacity="0.5"
          />
          <circle
            cx="400"
            cy="400"
            r="286"
            stroke="currentColor"
            strokeWidth="0.4"
            strokeDasharray="2 12"
            opacity="0.35"
          />
        </svg>
        <div className="sky-stars">
          {stars.map((star, index) => (
            <span
              key={index}
              className="sky-star"
              style={{
                left: `${star.left}%`,
                top: `${star.top}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                opacity: star.opacity,
              }}
            />
          ))}
        </div>
        <div className="sky-veil" />
      </div>
    )
  }

  return (
    <div className="sky" aria-hidden="true">
      <div className="sky-aurora aurora-one" />
      <div className="sky-aurora aurora-two" />
      <div className="sky-nebula">
        <span className="nebula nebula-rose" />
        <span className="nebula nebula-blue" />
        <span className="nebula nebula-ember" />
      </div>
      <div className="sky-rays" />
      <div className="sky-glow glow-one" />
      <div className="sky-glow glow-two" />
      <div className="sky-glow glow-three" />
      <div className="sky-glow glow-four" />
      <span className="sky-moon" />
      <span className="sky-planet" />

      <svg
        className="sky-orbits"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <ellipse
          cx="760"
          cy="470"
          rx="670"
          ry="260"
          transform="rotate(-16 760 470)"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray="3 10"
          opacity="0.2"
        />
        <ellipse
          cx="700"
          cy="430"
          rx="470"
          ry="170"
          transform="rotate(22 700 430)"
          stroke="currentColor"
          strokeWidth="0.4"
          opacity="0.12"
        />
        <circle cx="220" cy="360" r="2" fill="currentColor" opacity="0.5" />
        <circle cx="1220" cy="640" r="1.6" fill="currentColor" opacity="0.4" />
      </svg>

      <svg
        className="sky-mandala"
        viewBox="0 0 800 800"
        fill="none"
        stroke="currentColor"
      >
        <circle cx="400" cy="400" r="392" strokeWidth="0.6" opacity="0.5" />
        <circle cx="400" cy="400" r="374" strokeWidth="0.35" opacity="0.3" />
        <circle
          cx="400"
          cy="400"
          r="330"
          strokeWidth="0.4"
          strokeDasharray="2 6"
          opacity="0.45"
        />
        <circle cx="400" cy="400" r="236" strokeWidth="0.5" opacity="0.3" />
        <circle
          cx="400"
          cy="400"
          r="128"
          strokeWidth="0.4"
          strokeDasharray="1 5"
          opacity="0.4"
        />
        {mandalaTicks.map((tick) => (
          <line
            key={tick.key}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            strokeWidth={tick.major ? 0.7 : 0.35}
            opacity={tick.major ? 0.65 : 0.35}
          />
        ))}
        {mandalaMarks.map((mark) => (
          <rect
            key={mark.key}
            x={mark.x - 3}
            y={mark.y - 3}
            width="6"
            height="6"
            transform={`rotate(45 ${mark.x} ${mark.y})`}
            strokeWidth="0.6"
            opacity="0.55"
          />
        ))}
      </svg>

      <svg
        className="sky-constellations"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {constellationGroups.map((group, groupIndex) => (
          <g key={groupIndex} opacity={groupIndex === 1 ? 0.55 : 0.4}>
            {group.links.map(([from, to], linkIndex) => (
              <line
                key={linkIndex}
                x1={group.points[from][0]}
                y1={group.points[from][1]}
                x2={group.points[to][0]}
                y2={group.points[to][1]}
                stroke="currentColor"
                strokeWidth="0.6"
                opacity="0.5"
              />
            ))}
            {group.points.map(([x, y], pointIndex) => (
              <g key={pointIndex}>
                <circle cx={x} cy={y} r="6" fill="currentColor" opacity="0.05" />
                <circle cx={x} cy={y} r="1.6" fill="currentColor" opacity="0.85" />
              </g>
            ))}
          </g>
        ))}
      </svg>

      <div className="sky-stars">
        {stars.map((star, index) => (
          <span
            key={index}
            className="sky-star"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            }}
          />
        ))}
      </div>

      <div className="sky-dust">
        {dust.map((mote, index) => (
          <span
            key={index}
            className="sky-mote"
            style={
              {
                left: `${mote.left}%`,
                top: `${mote.top}%`,
                width: `${mote.size}px`,
                height: `${mote.size}px`,
                opacity: mote.opacity,
                animationDelay: `${mote.delay}s`,
                animationDuration: `${mote.duration}s`,
                '--dx': `${mote.dx}px`,
                '--dy': `${mote.dy}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <span className="shooting shooting-a" />
      <span className="shooting shooting-b" />

      <div className="sky-fog fog-one" />
      <div className="sky-fog fog-two" />
      <span className="sky-bokeh bokeh-one" />
      <span className="sky-bokeh bokeh-two" />
      <span className="sky-bokeh bokeh-three" />

      <div className="sky-veil" />
      <div className="sky-grain" />
      <div className="sky-cursor" ref={cursorRef} />
    </div>
  )
}
