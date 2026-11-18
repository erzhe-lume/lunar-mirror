const TICKS = Array.from({ length: 24 }, (_, index) => {
  const angle = (index / 24) * Math.PI * 2 - Math.PI / 2
  const major = index % 6 === 0
  const inner = major ? 96 : 100
  return {
    index,
    major,
    x1: 120 + Math.cos(angle) * inner,
    y1: 120 + Math.sin(angle) * inner,
    x2: 120 + Math.cos(angle) * 105,
    y2: 120 + Math.sin(angle) * 105,
  }
})

const DIAMONDS = [45, 135, 225, 315].map((degree) => {
  const angle = ((degree - 90) * Math.PI) / 180
  return {
    x: 120 + Math.cos(angle) * 86,
    y: 120 + Math.sin(angle) * 86,
  }
})

interface Props {
  variant?: 'timeline' | 'mirror'
}

export default function CelestialEmpty({ variant = 'timeline' }: Props) {
  return (
    <div
      className={`celestial-empty celestial-empty-${variant}`}
      aria-hidden="true"
    >
      <span className="empty-halo" />
      <svg viewBox="0 0 240 240" fill="none">
        <circle
          cx="120"
          cy="120"
          r="104"
          stroke="currentColor"
          strokeOpacity="0.24"
          strokeWidth="0.8"
        />
        <circle
          cx="120"
          cy="120"
          r="96"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="0.7"
          strokeDasharray="2 9"
        />
        <circle
          cx="120"
          cy="120"
          r="78"
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="0.6"
        />

        {TICKS.map((tick) => (
          <line
            key={tick.index}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="currentColor"
            strokeOpacity={tick.major ? 0.5 : 0.24}
            strokeWidth={tick.major ? 0.9 : 0.6}
          />
        ))}

        {DIAMONDS.map(({ x, y }) => (
          <path
            key={`${x}-${y}`}
            d="M 0 -3.4 L 1.8 0 L 0 3.4 L -1.8 0 Z"
            fill="currentColor"
            fillOpacity="0.55"
            transform={`translate(${x} ${y})`}
          />
        ))}

        <g className="empty-orbit">
          <circle cx="120" cy="16" r="2.1" fill="currentColor" />
          <circle cx="120" cy="224" r="1.1" fill="currentColor" opacity="0.5" />
        </g>

        {variant === 'timeline' ? (
          <g className="empty-glyph">
            <path
              d="M120 82 L120 158"
              stroke="currentColor"
              strokeOpacity="0.36"
              strokeWidth="0.7"
              strokeDasharray="1 6"
            />
            <circle cx="120" cy="82" r="1.8" fill="currentColor" />
            <circle cx="120" cy="120" r="2.5" fill="currentColor" />
            <circle cx="120" cy="158" r="1.8" fill="currentColor" />
            <path
              d="M120 60 L122.4 77.6 L140 80 L122.4 82.4 L120 100 L117.6 82.4 L100 80 L117.6 77.6 Z"
              fill="currentColor"
              fillOpacity="0.8"
            />
            <path
              d="M96 120 L98.2 124.8 L103 127 L98.2 129.2 L96 134 L93.8 129.2 L89 127 L93.8 124.8 Z"
              fill="currentColor"
              fillOpacity="0.4"
            />
            <path
              d="M144 120 L146.2 124.8 L151 127 L146.2 129.2 L144 134 L141.8 129.2 L137 127 L141.8 124.8 Z"
              fill="currentColor"
              fillOpacity="0.4"
            />
          </g>
        ) : (
          <g className="empty-glyph">
            <path
              d="M138 84 A 38 38 0 1 0 138 156 A 30 30 0 1 1 138 84 Z"
              stroke="currentColor"
              strokeOpacity="0.62"
              strokeWidth="0.9"
            />
            <path
              d="M151 64 L153.2 72.8 L162 75 L153.2 77.2 L151 86 L148.8 77.2 L140 75 L148.8 72.8 Z"
              fill="currentColor"
              fillOpacity="0.85"
            />
            <circle cx="120" cy="120" r="1.2" fill="currentColor" opacity="0.7" />
          </g>
        )}
      </svg>
    </div>
  )
}
