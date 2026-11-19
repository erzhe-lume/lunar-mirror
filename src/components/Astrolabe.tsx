import { useId } from 'react'

const GLYPHS = [
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
const OUTER_TICKS = Array.from({ length: 72 }, (_, index) => index * 5)
const INNER_TICKS = Array.from({ length: 24 }, (_, index) => index * 15)

export default function Astrolabe() {
  const uid = useId().replace(/:/g, '')
  const goldId = `astroGold-${uid}`
  const goldRef = `url(#${goldId})`
  return (
    <svg
      viewBox="0 0 720 720"
      className="astrolabe-svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={goldId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e9ecee" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#b9c0c8" stopOpacity="0.08" />
        </linearGradient>
      </defs>

      <circle
        cx="360"
        cy="360"
        r="344"
        fill="none"
        stroke={goldRef}
        strokeOpacity="0.45"
      />
      <circle
        cx="360"
        cy="360"
        r="318"
        fill="none"
        stroke="#b9c0c8"
        strokeOpacity="0.18"
        strokeDasharray="1 9"
      />
      <circle
        cx="360"
        cy="360"
        r="280"
        fill="none"
        stroke="#b9c0c8"
        strokeOpacity="0.2"
      />
      <circle
        cx="360"
        cy="360"
        r="222"
        fill="none"
        stroke="#b9c0c8"
        strokeOpacity="0.14"
        strokeDasharray="2 12"
      />
      <circle cx="360" cy="360" r="110" fill="none" stroke="#b9c0c8" strokeOpacity="0.22" />

      <g className="astro-outer">
        {OUTER_TICKS.map((degree) => (
          <line
            key={degree}
            x1="360"
            y1="16"
            x2="360"
            y2={degree % 30 === 0 ? 38 : 26}
            stroke="#b9c0c8"
            strokeOpacity={degree % 30 === 0 ? 0.5 : 0.22}
            strokeWidth={degree % 30 === 0 ? 1 : 0.6}
            transform={`rotate(${degree} 360 360)`}
          />
        ))}
        {GLYPHS.map((glyph, index) => (
          <text
            key={glyph}
            x="360"
            y="64"
            fill="#b9c0c8"
            fillOpacity="0.6"
            fontSize="17"
            textAnchor="middle"
            transform={`rotate(${index * 30} 360 360)`}
          >
            {glyph}
          </text>
        ))}
      </g>

      <g className="astro-inner">
        {INNER_TICKS.map((degree) => (
          <line
            key={degree}
            x1="360"
            y1="80"
            x2="360"
            y2="92"
            stroke="#b9c0c8"
            strokeOpacity="0.28"
            strokeWidth="0.7"
            transform={`rotate(${degree} 360 360)`}
          />
        ))}
        {['I', 'II', 'III', 'IV'].map((numeral, index) => (
          <text
            key={numeral}
            x="360"
            y="112"
            fill="#b9c0c8"
            fillOpacity="0.42"
            fontSize="9"
            letterSpacing="3"
            textAnchor="middle"
            transform={`rotate(${index * 90 + 45} 360 360)`}
          >
            {numeral}
          </text>
        ))}
      </g>

      <g stroke="#b9c0c8" strokeOpacity="0.16">
        <path d="M360 18 L360 700" />
        <path d="M18 360 L700 360" />
      </g>
      <circle cx="360" cy="360" r="4" fill="#e9ecee" fillOpacity="0.5" />
    </svg>
  )
}
