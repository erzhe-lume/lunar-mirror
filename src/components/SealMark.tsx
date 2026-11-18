function fourPointStar(cx: number, cy: number, radius: number): string {
  const waist = radius * 0.3
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

const ticks = Array.from({ length: 16 }, (_, index) => {
  const angle = (index / 16) * Math.PI * 2 - Math.PI / 2
  const major = index % 4 === 0
  return {
    key: index,
    major,
    x1: 24 + Math.cos(angle) * (major ? 18.6 : 19),
    y1: 24 + Math.sin(angle) * (major ? 18.6 : 19),
    x2: 24 + Math.cos(angle) * 20.2,
    y2: 24 + Math.sin(angle) * 20.2,
  }
})

export default function SealMark() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="seal-mark"
      aria-hidden="true"
    >
      <circle className="seal-disc" cx="24" cy="24" r="22.8" />
      <circle className="seal-rim" cx="24" cy="24" r="22" />
      <circle className="seal-ring" cx="24" cy="24" r="19.8" />
      <circle
        className="seal-ring seal-ring-dash"
        cx="24"
        cy="24"
        r="17.3"
        strokeDasharray="0.55 2.4"
      />
      <g className="seal-ticks">
        {ticks.map((tick) => (
          <line
            key={tick.key}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            opacity={tick.major ? 0.55 : 0.22}
          />
        ))}
      </g>
      <ellipse
        className="seal-orbit"
        cx="24"
        cy="24"
        rx="12.8"
        ry="6.4"
        transform="rotate(-26 24 24)"
      />
      <ellipse className="seal-mirror" cx="24" cy="24" rx="8.4" ry="11.2" />
      <ellipse
        className="seal-mirror-line"
        cx="24"
        cy="24"
        rx="6.7"
        ry="9.4"
      />
      <path
        className="seal-crescent"
        d="M27.1 15.2 C21.9 17.4 18.8 21.3 18.8 25.2 C18.8 29.8 21.9 34.1 27.1 36.4 C24.5 32.2 23.1 28.7 23.1 24.8 C23.1 21 24.5 17.7 27.1 15.2 Z"
      />
      <path className="seal-star" d={fourPointStar(29.2, 21.4, 2.75)} />
      <path
        className="seal-star seal-star-faint"
        d={fourPointStar(29.2, 21.4, 2.75)}
        transform="rotate(45 29.2 21.4)"
      />
      <circle className="seal-jewel" cx="29.2" cy="21.4" r="0.55" />
      <circle className="seal-dot" cx="27.8" cy="31.2" r="0.42" />
      <circle className="seal-dot" cx="30.8" cy="27.8" r="0.3" />
      <path
        className="seal-link"
        d="M27.8 31.2 L29.2 21.4 L30.8 27.8"
      />
    </svg>
  )
}
