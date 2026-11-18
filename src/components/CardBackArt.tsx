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

const rays = Array.from({ length: 24 }, (_, index) => {
  const angle = (index / 24) * Math.PI * 2 - Math.PI / 2
  const major = index % 4 === 0
  const inner = major ? 31.5 : 35
  return {
    key: index,
    major,
    x1: 60 + Math.cos(angle) * inner,
    y1: 90 + Math.sin(angle) * inner,
    x2: 60 + Math.cos(angle) * (major ? 41.5 : 39),
    y2: 90 + Math.sin(angle) * (major ? 41.5 : 39),
  }
})

const phaseMarks = Array.from({ length: 8 }, (_, index) => {
  const angle = (index / 8) * Math.PI * 2 - Math.PI / 2
  return {
    key: index,
    x: 60 + Math.cos(angle) * 47,
    y: 90 + Math.sin(angle) * 47,
    filled: index % 2 === 0,
  }
})

const fieldStars = [
  [31, 47, 1.15],
  [89, 43, 0.9],
  [24, 119, 0.85],
  [96, 126, 1.05],
  [72, 31, 0.7],
  [45, 145, 0.65],
]

function CornerFlourish({ goldRef }: { goldRef: string }) {
  return (
    <g
      fill="none"
      stroke={goldRef}
      strokeWidth="0.55"
      strokeLinecap="round"
    >
      <path d="M13.5 30 C13.5 21 21 13.5 30 13.5" />
      <path d="M17 31 C17 23 23 17 31 17" opacity="0.58" />
      <path d="M21.5 19 C24.5 15.8 28.5 14.8 32 15.8" opacity="0.42" />
      <path d="M15.8 24.5 C14 28 14 32 15.8 35.5" opacity="0.4" />
      <circle cx="14.2" cy="14.2" r="1" fill={goldRef} stroke="none" />
      <path
        d="M24 24 L25.3 25.3 L24 26.6 L22.7 25.3 Z"
        fill={goldRef}
        stroke="none"
        opacity="0.45"
      />
    </g>
  )
}

export default function CardBackArt() {
  const uid = useId().replace(/:/g, '')
  const goldId = `cardGold-${uid}`
  const coreId = `cardCore-${uid}`
  const glassId = `cardGlass-${uid}`
  const glowId = `cardGlow-${uid}`
  const latticeId = `cardLattice-${uid}`
  const grainId = `cardGrain-${uid}`
  const goldRef = `url(#${goldId})`
  const coreRef = `url(#${coreId})`
  const glassRef = `url(#${glassId})`
  const glowRef = `url(#${glowId})`

  return (
    <svg viewBox="0 0 120 180" className="back-art" aria-hidden="true">
      <defs>
        <linearGradient id={goldId} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#fff1c8" />
          <stop offset="28%" stopColor="#e1bd75" />
          <stop offset="62%" stopColor="#a77d3c" />
          <stop offset="84%" stopColor="#dfb86e" />
          <stop offset="100%" stopColor="#f7e3ac" />
        </linearGradient>
        <radialGradient id={coreId} cx="50%" cy="44%" r="62%">
          <stop offset="0%" stopColor="#3a2854" stopOpacity="0.95" className="back-core-top" />
          <stop offset="46%" stopColor="#1d142f" stopOpacity="0.88" className="back-core-mid" />
          <stop offset="100%" stopColor="#08050f" stopOpacity="0.96" className="back-core-bottom" />
        </radialGradient>
        <linearGradient id={glassId} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#2e2148" className="back-glass-top" />
          <stop offset="48%" stopColor="#171026" className="back-glass-mid" />
          <stop offset="100%" stopColor="#090611" className="back-glass-bottom" />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f4dda1" stopOpacity="0.32" />
          <stop offset="62%" stopColor="#d9b667" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#d9b667" stopOpacity="0" />
        </radialGradient>
        <pattern
          id={latticeId}
          width="11"
          height="11"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <path
            d="M0 0 H11 M0 0 V11"
            fill="none"
            stroke={goldRef}
            strokeWidth="0.24"
            opacity="0.35"
          />
        </pattern>
        <pattern
          id={grainId}
          width="2.8"
          height="2.8"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="0.7" cy="0.8" r="0.16" fill={goldRef} opacity="0.3" />
          <circle cx="2" cy="1.9" r="0.1" fill={goldRef} opacity="0.18" />
        </pattern>
      </defs>

      <rect
        x="4.5"
        y="4.5"
        width="111"
        height="171"
        rx="6"
        fill="none"
        stroke={goldRef}
        strokeWidth="1"
        opacity="0.92"
      />
      <rect
        x="7.8"
        y="7.8"
        width="104.4"
        height="164.4"
        rx="4.5"
        fill="none"
        stroke={goldRef}
        strokeWidth="0.34"
        opacity="0.5"
      />
      <rect
        x="11"
        y="11"
        width="98"
        height="158"
        rx="3"
        fill={coreRef}
      />
      <rect
        x="11"
        y="11"
        width="98"
        height="158"
        rx="3"
        fill={`url(#${latticeId})`}
        opacity="0.28"
      />
      <rect
        x="11"
        y="11"
        width="98"
        height="158"
        rx="3"
        fill={`url(#${grainId})`}
        opacity="0.5"
      />
      <rect
        x="13.2"
        y="13.2"
        width="93.6"
        height="153.6"
        rx="2.4"
        fill="none"
        stroke={goldRef}
        strokeWidth="0.3"
        strokeDasharray="0.7 3.2"
        opacity="0.42"
      />

      <ellipse cx="60" cy="90" rx="47" ry="66" fill="none" stroke={goldRef} strokeWidth="0.35" opacity="0.18" />
      <circle cx="60" cy="90" r="42" fill={glowRef} opacity="0.7" />
      <g opacity="0.48">
        {rays.map((ray) => (
          <line
            key={ray.key}
            x1={ray.x1}
            y1={ray.y1}
            x2={ray.x2}
            y2={ray.y2}
            stroke={goldRef}
            strokeWidth={ray.major ? 0.5 : 0.25}
            opacity={ray.major ? 0.64 : 0.32}
          />
        ))}
      </g>
      <circle cx="60" cy="90" r="42" fill="none" stroke={goldRef} strokeWidth="0.45" opacity="0.42" />
      <circle
        cx="60"
        cy="90"
        r="37"
        fill="none"
        stroke={goldRef}
        strokeWidth="0.3"
        strokeDasharray="0.8 3.1"
        opacity="0.5"
      />

      {phaseMarks.map((mark) => (
        <path
          key={mark.key}
          d={fourPointStar(mark.x, mark.y, mark.filled ? 1.9 : 1.4)}
          fill={mark.filled ? goldRef : 'none'}
          stroke={goldRef}
          strokeWidth="0.32"
          opacity={mark.filled ? 0.72 : 0.4}
        />
      ))}

      <path
        d="M60 31 C40 51 31 74 31 92 C31 117 43 138 60 151 C77 138 89 117 89 92 C89 74 80 51 60 31 Z"
        fill="none"
        stroke={goldRef}
        strokeWidth="0.72"
        opacity="0.52"
      />
      <path
        d="M60 37 C43.5 55 36 76 36 92 C36 114 46 132 60 143 C74 132 84 114 84 92 C84 76 76.5 55 60 37 Z"
        fill="none"
        stroke={goldRef}
        strokeWidth="0.3"
        strokeDasharray="1 3.6"
        opacity="0.42"
      />

      <g fill="none" stroke={goldRef} strokeLinecap="round">
        <path d="M41 115 C28 107 22 92 25 73" strokeWidth="0.6" opacity="0.74" />
        <path d="M41 108 C31 99 27 86 30 75" strokeWidth="0.42" opacity="0.58" />
        <path d="M41 101 C34 93 32 83 35 75" strokeWidth="0.32" opacity="0.44" />
        <path d="M38 117 C23 111 16 98 16 81" strokeWidth="0.28" strokeDasharray="0.6 2.8" opacity="0.38" />
        <path d="M79 115 C92 107 98 92 95 73" strokeWidth="0.6" opacity="0.74" />
        <path d="M79 108 C89 99 93 86 90 75" strokeWidth="0.42" opacity="0.58" />
        <path d="M79 101 C86 93 88 83 85 75" strokeWidth="0.32" opacity="0.44" />
        <path d="M82 117 C97 111 104 98 104 81" strokeWidth="0.28" strokeDasharray="0.6 2.8" opacity="0.38" />
      </g>
      <g fill={goldRef} opacity="0.52">
        <circle cx="25" cy="73" r="0.85" />
        <circle cx="27" cy="87" r="0.6" />
        <circle cx="30" cy="99" r="0.55" />
        <circle cx="95" cy="73" r="0.85" />
        <circle cx="93" cy="87" r="0.6" />
        <circle cx="90" cy="99" r="0.55" />
      </g>
      <g fill={goldRef} opacity="0.28">
        <path d="M25 73 C21 69 22 64 27 62 C30 66 29 70 25 73 Z" />
        <path d="M95 73 C99 69 98 64 93 62 C90 66 91 70 95 73 Z" />
        <path d="M30 99 C26 97 24 92 27 88 C31 90 33 95 30 99 Z" />
        <path d="M90 99 C94 97 96 92 93 88 C89 90 87 95 90 99 Z" />
      </g>

      <path d="M51 53 C54 48 57 44 60 40 C63 44 66 48 69 53" fill="none" stroke={goldRef} strokeWidth="0.5" opacity="0.52" />
      <g opacity="0.82">
        <path d={fourPointStar(60, 36, 5.5)} fill={goldRef} />
        <path d={fourPointStar(60, 36, 3.1)} transform="rotate(45 60 36)" fill={goldRef} opacity="0.36" />
      </g>
      <circle cx="60" cy="47" r="1.1" fill={goldRef} opacity="0.58" />

      <ellipse cx="60" cy="90" rx="24" ry="34" fill={glassRef} />
      <ellipse cx="60" cy="90" rx="24" ry="34" fill="none" stroke={goldRef} strokeWidth="1.05" opacity="0.95" />
      <ellipse cx="60" cy="90" rx="20.4" ry="30.2" fill="none" stroke={goldRef} strokeWidth="0.34" opacity="0.6" />
      <ellipse cx="60" cy="90" rx="17.2" ry="26.6" fill="none" stroke={goldRef} strokeWidth="0.22" strokeDasharray="0.7 2.8" opacity="0.36" />
      <ellipse cx="60" cy="90" rx="13.6" ry="23" fill="none" stroke={goldRef} strokeWidth="0.16" strokeDasharray="0.45 2.4" opacity="0.22" />

      <path d="M46 112 C53 94 64 76 74 61" fill="none" stroke="#fff4d8" strokeWidth="4.2" opacity="0.026" />
      <path d="M44 103 C53 89 62 76 71 64" fill="none" stroke="#fff4d8" strokeWidth="0.9" opacity="0.048" />

      <circle cx="60" cy="90" r="12" fill={glowRef} opacity="0.5" />
      <path
        d="M54.2 66.8 C45.8 72.2 40.8 80.8 40.8 90 C40.8 99.6 45.8 108.2 54.2 114 C51.6 106 49.4 98 49.4 90 C49.4 81.8 51.6 73.5 54.2 66.8 Z"
        fill={goldRef}
        opacity="0.16"
      />
      <path
        d="M54.2 66.8 C45.8 72.2 40.8 80.8 40.8 90 C40.8 99.6 45.8 108.2 54.2 114 C51.6 106 49.4 98 49.4 90 C49.4 81.8 51.6 73.5 54.2 66.8 Z"
        fill="none"
        stroke={goldRef}
        strokeWidth="0.46"
        opacity="0.86"
      />
      <path
        d="M51.8 69.8 C44.8 75 41 82 41 90 C41 98 44.8 105 51.8 110.2"
        fill="none"
        stroke={goldRef}
        strokeWidth="0.18"
        opacity="0.3"
      />
      <path d="M60 42 V58" fill="none" stroke={goldRef} strokeWidth="0.2" opacity="0.26" />
      <path d="M60 122 V140" fill="none" stroke={goldRef} strokeWidth="0.2" opacity="0.26" />
      <ellipse
        cx="60"
        cy="89"
        rx="15.4"
        ry="11.4"
        fill="none"
        stroke={goldRef}
        strokeWidth="0.22"
        strokeDasharray="0.9 2.8"
        opacity="0.32"
        transform="rotate(-27 60 89)"
      />
      <g fill={goldRef} opacity="0.94">
        <path d={fourPointStar(65, 84, 3.8)} />
        <path
          d={fourPointStar(65, 84, 3.8)}
          transform="rotate(45 65 84)"
          opacity="0.28"
        />
        <circle cx="65" cy="84" r="0.7" fill="#fff7df" opacity="0.92" />
      </g>
      <path d={fourPointStar(70.5, 94, 1.15)} fill={goldRef} opacity="0.5" />
      <circle cx="48.5" cy="99" r="0.45" fill={goldRef} opacity="0.5" />
      <path
        d="M48.5 99 L55 94 L65 84"
        fill="none"
        stroke={goldRef}
        strokeWidth="0.18"
        opacity="0.24"
      />
      <circle cx="53" cy="68" r="0.4" fill={goldRef} opacity="0.4" />
      <circle cx="53" cy="112" r="0.4" fill={goldRef} opacity="0.4" />

      <path d="M46 126 C46 137 52 143 60 152 C68 143 74 137 74 126" fill="none" stroke={goldRef} strokeWidth="0.4" strokeDasharray="0.7 3.2" opacity="0.45" />
      <path d={fourPointStar(60, 146, 3.8)} fill={goldRef} opacity="0.68" />
      <circle cx="60" cy="154" r="1" fill={goldRef} opacity="0.55" />

      <CornerFlourish goldRef={goldRef} />
      <g transform="translate(120 0) scale(-1 1)">
        <CornerFlourish goldRef={goldRef} />
      </g>
      <g transform="translate(0 180) scale(1 -1)">
        <CornerFlourish goldRef={goldRef} />
      </g>
      <g transform="translate(120 180) scale(-1 -1)">
        <CornerFlourish goldRef={goldRef} />
      </g>

      <path d="M60 17 L61.6 20.2 L65 21.8 L61.6 23.4 L60 26.6 L58.4 23.4 L55 21.8 L58.4 20.2 Z" fill={goldRef} opacity="0.52" />
      <path d="M60 154 L61.5 158 L65 159.5 L61.5 161 L60 165 L58.5 161 L55 159.5 L58.5 158 Z" fill={goldRef} opacity="0.45" />
      <path d="M21 90 L23 92 L21 94 L19 92 Z" fill={goldRef} opacity="0.4" />
      <path d="M99 90 L101 92 L99 94 L97 92 Z" fill={goldRef} opacity="0.4" />

      {fieldStars.map(([x, y, size], index) => (
        <g key={index} opacity="0.3">
          <path
            d={`M${x} ${y - size} L${x + size * 0.28} ${y} L${x} ${y + size} L${x - size * 0.28} ${y} Z`}
            fill={goldRef}
          />
          <path
            d={`M${x - size} ${y} L${x} ${y + size * 0.28} L${x + size} ${y} L${x} ${y - size * 0.28} Z`}
            fill={goldRef}
          />
        </g>
      ))}
    </svg>
  )
}
