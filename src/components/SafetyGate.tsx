import { useEffect, useState } from 'react'
import type { SafetyKind } from '../lib/crisis'
import { SAFETY_COPY } from '../data/safety-copy'
import { useFocusTrap } from '../lib/useFocusTrap'

interface Props {
  querent?: string
  kind: SafetyKind
  onClose: () => void
}

export default function SafetyGate({ querent, kind, onClose }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(true)
  const content = SAFETY_COPY[kind]
  const [comfortIndex, setComfortIndex] = useState(() =>
    Math.floor(Math.random() * content.comforts.length),
  )
  const comfort = content.comforts[comfortIndex] ?? content.comforts[0]

  useEffect(() => {
    setComfortIndex(
      Math.floor(Math.random() * SAFETY_COPY[kind].comforts.length),
    )
  }, [kind])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])
  return (
    <div
      className="modal-veil safety-veil"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="safety-title"
      aria-describedby="safety-description"
    >
      <div
        className="modal safety-modal ornate-corners"
        ref={trapRef}
        tabIndex={-1}
      >
        <span className="safety-emblem" aria-hidden="true">
          ✦
        </span>
        <span className="eyebrow">安全优先 · SAFETY FIRST</span>
        <p className="safety-comfort">{comfort}</p>
        <h2 id="safety-title">{content.title}</h2>
        <p id="safety-description" className="safety-lead">
          {content.lead}
        </p>
        {querent && (
          <p className="safety-querent">
            如果这是替「{querent}」问的，请先确认对方和周围人的安全，并立即联系对方身边可信任的人或报警。
          </p>
        )}

        <div className="safety-actions">
          <a href="tel:110" className="safety-call">
            <strong>110</strong>
            <span>报警</span>
          </a>
          <a href="tel:120" className="safety-call">
            <strong>120</strong>
            <span>急救</span>
          </a>
          <a href="tel:12356" className="safety-call">
            <strong>12356</strong>
            <span>心理援助</span>
          </a>
        </div>

        <ul className="safety-steps">
          {content.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>

        <p className="safety-close-note">{content.close}</p>
        <button type="button" className="ghost-btn safety-return" onClick={onClose}>
          我暂时安全，返回首页
        </button>
      </div>
    </div>
  )
}
