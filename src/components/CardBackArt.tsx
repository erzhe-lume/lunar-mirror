import { useId } from 'react'

function fourPointStar(cx: number, cy: number, radius: number): string {
  const waist = radius * 0.28
  return [
    `M${cx} ${cy - radius}`,
    `L${cx + waist} ${cy - waist}`,
    `L${cx + radius} ${cy}`,
    `L${cx + waist} ${cy + waist}`,
    `L${cx} ${cy + radius}`,
    `L${cx - waist} ${cy + waist}`,
    `L${cx - radius} ${cy}`,
    `L${cx - waist} ${cy - waist}`,
    'Z',
  ].join(' ')
}

const rays = Array.from({ length: 32 }, (_, index) => {
  const angle = (index / 32) * Math.PI * 2 - Math.PI / 2
  const major = index % 4 === 0
  const mid = index % 2 === 0
  return {
    key: index,
    major,
    mid,
    x1: 60 + Math.cos(angle) * (major ? 31.5 : 35.2),
    y1: 90 + Math.sin(angle) * (major ? 31.5 : 35.2),
    x2: 60 + Math.cos(angle) * (major ? 42.2 : mid ? 39.6 : 38),
    y2: 90 + Math.sin(angle) * (major ? 42.2 : mid ? 39.6 : 38),
  }
})

const phases = Array.from({ length: 8 }, (_, index) => {
  const angle = (index / 8) * Math.PI * 2 - Math.PI / 2
  return {
    key: index,
    x: 60 + Math.cos(angle) * 47.2,
    y: 90 + Math.sin(angle) * 47.2,
    filled: index % 2 === 0,
  }
})

const orbitTicks = Array.from({ length: 16 }, (_, index) => {
  const angle = (index / 16) * Math.PI * 2 - Math.PI / 2
  const major = index % 4 === 0
  return {
    key: index,
    major,
    x1: 60 + Math.cos(angle) * (major ? 44 : 45.2),
    y1: 90 + Math.sin(angle) * (major ? 44 : 45.2),
    x2: 60 + Math.cos(angle) * 46.4,
    y2: 90 + Math.sin(angle) * 46.4,
  }
})

const fieldStars = [
  [30.5, 48, 1.05],
  [89, 45, 0.82],
  [25, 122, 0.78],
  [95, 127, 0.96],
  [72, 29, 0.66],
  [45, 150, 0.58],
  [36, 64, 0.42],
  [84, 114, 0.4],
]

function CornerBracket({ silverRef }: { silverRef: string }) {
  return (
    <g fill="none" stroke={silverRef} strokeLinecap="round">
      <path d="M13 35 V21 Q13 13 21 13 H35" strokeWidth="0.85" opacity="0.92" />
      <path d="M17 35 V23 Q17 17 23 17 H35" strokeWidth="0.28" opacity="0.48" />
      <path d="M13 41 V37 M41 13 H37" strokeWidth="0.3" opacity="0.4" />
      <path d="M17 29 C20.5 25.5 24.5 22.5 29 20.5" strokeWidth="0.24" opacity="0.35" />
      <path
        d="M21.5 21.5 L23.4 23.4 L21.5 25.3 L19.6 23.4 Z"
        fill={silverRef}
        stroke="none"
        opacity="0.86"
      />
      <path d="M26.5 13 V15.4 M13 26.5 H15.4" strokeWidth="0.34" opacity="0.56" />
    </g>
  )
}

export default function CardBackArt() {
  const uid = useId().replace(/:/g, '')
  const silverId = `cardSilver-${uid}`
  const coreId = `cardCore-${uid}`
  const glassId = `cardGlass-${uid}`
  const haloId = `cardHalo-${uid}`
  const guillocheId = `cardGuilloche-${uid}`
  const grainId = `cardGrain-${uid}`
  const silverRef = `url(#${silverId})`
  const coreRef = `url(#${coreId})`
  const glassRef = `url(#${glassId})`
  const haloRef = `url(#${haloId})`

  return (
    <svg viewBox="0 0 120 180" className="back-art" aria-hidden="true">
      <defs>
        <linearGradient id={silverId} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="18%" stopColor="#d5d8dc" />
          <stop offset="42%" stopColor="#8e959e" />
          <stop offset="58%" stopColor="#c9ced4" />
          <stop offset="78%" stopColor="#eef0f1" />
          <stop offset="100%" stopColor="#9aa1a9" />
        </linearGradient>
        <radialGradient id={coreId} cx="50%" cy="42%" r="66%">
          <stop offset="0%" stopColor="#30353c" stopOpacity="0.96" className="back-core-top" />
          <stop offset="48%" stopColor="#14171c" stopOpacity="0.92" className="back-core-mid" />
          <stop offset="100%" stopColor="#050608" stopOpacity="0.98" className="back-core-bottom" />
        </radialGradient>
        <linearGradient id={glassId} x1="0" y1="0" x2="0.42" y2="1">
          <stop offset="0%" stopColor="#2b3037" className="back-glass-top" />
          <stop offset="48%" stopColor="#14181d" className="back-glass-mid" />
          <stop offset="100%" stopColor="#07080a" className="back-glass-bottom" />
        </linearGradient>
        <radialGradient id={haloId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#edf0f2" stopOpacity="0.2" />
          <stop offset="58%" stopColor="#b9c0c8" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#b9c0c8" stopOpacity="0" />
        </radialGradient>
        <pattern
          id={guillocheId}
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <g fill="none" stroke={silverRef} strokeWidth="0.18" opacity="0.5">
            <circle cx="0" cy="0" r="7.4" />
            <circle cx="12" cy="12" r="7.4" />
            <circle cx="12" cy="0" r="7.4" />
            <circle cx="0" cy="12" r="7.4" />
          </g>
          <path d="M0 6 H12 M6 0 V12" stroke={silverRef} strokeWidth="0.1" opacity="0.18" />
        </pattern>
        <pattern id={grainId} width="2.7" height="2.7" patternUnits="userSpaceOnUse">
          <circle cx="0.6" cy="0.7" r="0.14" fill={silverRef} opacity="0.28" />
          <circle cx="1.9" cy="1.8" r="0.09" fill={silverRef} opacity="0.16" />
        </pattern>
      </defs>

      <rect
        x="3.6"
        y="3.6"
        width="112.8"
        height="172.8"
        rx="7.5"
        fill="none"
        stroke={silverRef}
        strokeWidth="1.15"
        opacity="0.9"
      />
      <rect
        x="7"
        y="7"
        width="106"
        height="166"
        rx="5"
        fill="none"
        stroke={silverRef}
        strokeWidth="0.4"
        opacity="0.52"
      />
      <rect x="10" y="10" width="100" height="160" rx="4" fill={coreRef} />
      <rect
        x="10"
        y="10"
        width="100"
        height="160"
        rx="4"
        fill={`url(#${guillocheId})`}
        opacity="0.28"
      />
      <rect
        x="10"
        y="10"
        width="100"
        height="160"
        rx="4"
        fill={`url(#${grainId})`}
        opacity="0.45"
      />
      <rect
        x="12.4"
        y="12.4"
        width="95.2"
        height="155.2"
        rx="2.8"
        fill="none"
        stroke={silverRef}
        strokeWidth="0.28"
        strokeDasharray="0.7 3.4"
        opacity="0.38"
      />

      <ellipse
        cx="60"
        cy="90"
        rx="47"
        ry="66"
        fill="none"
        stroke={silverRef}
        strokeWidth="0.32"
        opacity="0.24"
      />
      <circle cx="60" cy="90" r="43" fill={haloRef} opacity="0.9" />
      <g opacity="0.42">
        {rays.map((ray) => (
          <line
            key={ray.key}
            x1={ray.x1}
            y1={ray.y1}
            x2={ray.x2}
            y2={ray.y2}
            stroke={silverRef}
            strokeWidth={ray.major ? 0.52 : ray.mid ? 0.26 : 0.18}
            opacity={ray.major ? 0.7 : ray.mid ? 0.4 : 0.28}
          />
        ))}
      </g>
      <circle cx="60" cy="90" r="42.4" fill="none" stroke={silverRef} strokeWidth="0.45" opacity="0.48" />
      <circle
        cx="60"
        cy="90"
        r="37.4"
        fill="none"
        stroke={silverRef}
        strokeWidth="0.28"
        strokeDasharray="0.8 3.3"
        opacity="0.44"
      />

      <g opacity="0.5">
        {orbitTicks.map((tick) => (
          <line
            key={tick.key}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={silverRef}
            strokeWidth={tick.major ? 0.45 : 0.2}
            opacity={tick.major ? 0.62 : 0.32}
          />
        ))}
      </g>

      {phases.map((mark) => (
        <g key={mark.key}>
          <circle
            cx={mark.x}
            cy={mark.y}
            r={mark.filled ? 2.1 : 1.65}
            fill={mark.filled ? silverRef : 'none'}
            stroke={silverRef}
            strokeWidth="0.3"
            opacity={mark.filled ? 0.75 : 0.38}
          />
          {mark.filled && (
            <circle
              cx={mark.x + 0.75}
              cy={mark.y - 0.55}
              r="1.55"
              fill="#0a0c0f"
              opacity="0.85"
            />
          )}
        </g>
      ))}

      <g fill="none" stroke={silverRef} strokeLinecap="round">
        <path d="M39 116 C27 106 24 90 28 72" strokeWidth="0.58" opacity="0.7" />
        <path d="M38 109 C30 99 28 87 31 75" strokeWidth="0.36" opacity="0.48" />
        <path d="M37 102 C32 94 31 84 34 76" strokeWidth="0.24" opacity="0.34" />
        <path d="M81 116 C93 106 96 90 92 72" strokeWidth="0.58" opacity="0.7" />
        <path d="M82 109 C90 99 92 87 89 75" strokeWidth="0.36" opacity="0.48" />
        <path d="M83 102 C88 94 89 84 86 76" strokeWidth="0.24" opacity="0.34" />
      </g>
      <g fill={silverRef} opacity="0.48">
        <circle cx="28" cy="72" r="0.75" />
        <circle cx="31" cy="85" r="0.48" />
        <circle cx="34" cy="96" r="0.4" />
        <circle cx="92" cy="72" r="0.75" />
        <circle cx="89" cy="85" r="0.48" />
        <circle cx="86" cy="96" r="0.4" />
      </g>

      <path
        d="M52 55 C55 49 57.5 44 60 39 C62.5 44 65 49 68 55"
        fill="none"
        stroke={silverRef}
        strokeWidth="0.48"
        opacity="0.55"
      />
      <path d={fourPointStar(60, 30, 4.8)} fill={silverRef} opacity="0.82" />
      <path
        d={fourPointStar(60, 30, 4.8)}
        transform="rotate(45 60 30)"
        fill={silverRef}
        opacity="0.24"
      />
      <circle cx="60" cy="41" r="0.85" fill={silverRef} opacity="0.58" />

      <ellipse cx="60" cy="90" rx="26.4" ry="35.4" fill={glassRef} />
      <ellipse
        cx="60"
        cy="90"
        rx="26.4"
        ry="35.4"
        fill="none"
        stroke={silverRef}
        strokeWidth="1.15"
        opacity="0.98"
      />
      <ellipse
        cx="60"
        cy="90"
        rx="23.2"
        ry="32.1"
        fill="none"
        stroke={silverRef}
        strokeWidth="0.34"
        opacity="0.62"
      />
      <ellipse
        cx="60"
        cy="90"
        rx="20.2"
        ry="29"
        fill="none"
        stroke={silverRef}
        strokeWidth="0.2"
        strokeDasharray="0.7 2.9"
        opacity="0.32"
      />
      <ellipse
        cx="60"
        cy="90"
        rx="16.8"
        ry="25.6"
        fill="none"
        stroke={silverRef}
        strokeWidth="0.14"
        strokeDasharray="0.4 2.4"
        opacity="0.2"
      />

      <path d="M44 104 C54 88 64 73 73 63" fill="none" stroke="#ffffff" strokeWidth="5" opacity="0.035" />
      <path d="M43 96 C53 84 62 72 70 63" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.06" />

      <path
        d="M54 67.8 C47.2 72.4 42.8 80 42.8 90 C42.8 100 47.2 107.6 54 112.2 C51.4 104.2 49.6 97.2 49.6 90 C49.6 82.8 51.4 75.8 54 67.8 Z"
        fill={silverRef}
        opacity="0.9"
      />
      <path
        d="M52.6 71.2 C47 75.4 43.8 81.8 43.8 90 C43.8 98.2 47 104.6 52.6 108.8"
        fill="none"
        stroke="#0a0c0f"
        strokeWidth="0.34"
        opacity="0.55"
      />
      <g fill={silverRef}>
        <path d={fourPointStar(66, 85, 3.6)} />
        <path d={fourPointStar(66, 85, 3.6)} transform="rotate(45 66 85)" opacity="0.22" />
        <circle cx="66" cy="85" r="0.62" fill="#ffffff" opacity="0.9" />
      </g>
      <ellipse
        cx="60"
        cy="90"
        rx="14.8"
        ry="10.6"
        fill="none"
        stroke={silverRef}
        strokeWidth="0.22"
        strokeDasharray="0.9 2.9"
        opacity="0.34"
        transform="rotate(-25 60 90)"
      />
      <circle cx="71.5" cy="96" r="0.85" fill={silverRef} opacity="0.72" />
      <path d="M67 84 L71.5 96" fill="none" stroke={silverRef} strokeWidth="0.16" opacity="0.22" />
      <path d="M60 56 V65" fill="none" stroke={silverRef} strokeWidth="0.18" opacity="0.24" />
      <path d="M60 115 V124" fill="none" stroke={silverRef} strokeWidth="0.18" opacity="0.24" />

      <path
        d="M46 126 C46 137 52 143.5 60 152 C68 143.5 74 137 74 126"
        fill="none"
        stroke={silverRef}
        strokeWidth="0.36"
        strokeDasharray="0.7 3.2"
        opacity="0.42"
      />
      <path d={fourPointStar(60, 146.5, 3.4)} fill={silverRef} opacity="0.66" />
      <circle cx="60" cy="154.5" r="0.85" fill={silverRef} opacity="0.5" />

      <CornerBracket silverRef={silverRef} />
      <g transform="translate(120 0) scale(-1 1)">
        <CornerBracket silverRef={silverRef} />
      </g>
      <g transform="translate(0 180) scale(1 -1)">
        <CornerBracket silverRef={silverRef} />
      </g>
      <g transform="translate(120 180) scale(-1 -1)">
        <CornerBracket silverRef={silverRef} />
      </g>

      <path
        d="M60 16.5 L61.5 19.6 L64.6 21.1 L61.5 22.6 L60 25.7 L58.5 22.6 L55.4 21.1 L58.5 19.6 Z"
        fill={silverRef}
        opacity="0.48"
      />
      <path d="M21 90 L22.8 91.8 L21 93.6 L19.2 91.8 Z" fill={silverRef} opacity="0.38" />
      <path d="M99 90 L100.8 91.8 L99 93.6 L97.2 91.8 Z" fill={silverRef} opacity="0.38" />

      {fieldStars.map(([x, y, size], index) => (
        <g key={index} opacity="0.28">
          <path
            d={`M${x} ${y - size} L${x + size * 0.26} ${y} L${x} ${y + size} L${x - size * 0.26} ${y} Z`}
            fill={silverRef}
          />
          <path
            d={`M${x - size} ${y} L${x} ${y + size * 0.26} L${x + size} ${y} L${x} ${y - size * 0.26} Z`}
            fill={silverRef}
          />
        </g>
      ))}
    </svg>
  )
}
