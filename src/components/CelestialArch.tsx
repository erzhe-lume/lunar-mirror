import { useId } from 'react'

export default function CelestialArch({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  const goldId = `archGold-${uid}`
  const moonId = `archMoon-${uid}`
  const goldRef = `url(#${goldId})`
  const moonRef = `url(#${moonId})`
  return (
    <svg
      viewBox="0 0 600 480"
      className={`celestial-arch ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={goldId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4dda6" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#d9b970" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#d9b970" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={moonId} cx="42%" cy="36%" r="62%">
          <stop offset="0%" stopColor="#f6e9cd" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#d9b970" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#d9b970" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="300" cy="252" r="132" fill={moonRef} />
      <circle
        cx="300"
        cy="252"
        r="132"
        fill="none"
        stroke="#d9b970"
        strokeOpacity="0.14"
        strokeDasharray="1 7"
      />

      <path
        d="M64 456 L64 252 C64 172 158 92 300 28 C442 92 536 172 536 252 L536 456"
        fill="none"
        stroke={goldRef}
        strokeWidth="1"
      />
      <path
        d="M82 456 L82 256 C82 182 170 106 300 46 C430 106 518 182 518 256 L518 456"
        fill="none"
        stroke="#d9b970"
        strokeOpacity="0.1"
        strokeWidth="0.8"
      />
      <path
        d="M42 456 L558 456"
        stroke="#d9b970"
        strokeOpacity="0.2"
        strokeWidth="0.8"
      />

      <g fill="#f4dda6" opacity="0.65">
        <path d="M300 16 L302 24 L310 26 L302 28 L300 36 L298 28 L290 26 L298 24 Z" />
        <path d="M130 256 L132 262 L138 264 L132 266 L130 272 L128 266 L122 264 L128 262 Z" opacity="0.5" />
        <path d="M470 256 L472 262 L478 264 L472 266 L470 272 L468 266 L462 264 L468 262 Z" opacity="0.5" />
        <circle cx="196" cy="136" r="1.4" />
        <circle cx="408" cy="120" r="1.2" />
        <circle cx="470" cy="330" r="1.3" opacity="0.7" />
        <circle cx="120" cy="352" r="1.1" opacity="0.7" />
      </g>

      <g stroke="#d9b970" strokeOpacity="0.24">
        <path d="M56 456 L56 444 M544 456 L544 444" />
        <path d="M300 56 L300 80" />
      </g>
    </svg>
  )
}
