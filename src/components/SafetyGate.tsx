import { useEffect } from 'react'
import type { SafetyKind } from '../lib/crisis'
import { useFocusTrap } from '../lib/useFocusTrap'

interface Props {
  querent?: string
  kind: SafetyKind
  onClose: () => void
}

export default function SafetyGate({ querent, kind, onClose }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(true)
  const harmToOthers = kind === 'other' || kind === 'both'

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
  const comfort =
    kind === 'both'
      ? '这一刻的痛和冲动都是真的，但先不要做任何不可逆的事。先让自己安全，也让身边的人安全。'
      : harmToOthers
        ? '这一刻的恐惧、愤怒或冲动都是真的，但它不必变成不可挽回的事。先把距离拉开，让现实里的帮助进来。'
        : '这一刻一定很难。你愿意说出来，已经是在保护自己。你不需要先变得坚强，也值得被一个真实的人好好接住。'

  const steps = harmToOthers
    ? [
        '如果你有伤害他人的冲动，请立刻远离对方、武器和任何可能伤人的物品，离开冲突现场，去一个安全且有人的地方。',
        '如果你正被威胁、追赶或殴打，请优先保护自己，去有人的地方并拨打 110；有人受伤立刻拨打 120。',
        '联系一个能马上陪着你的人，把现在的处境告诉对方。',
        '中国大陆可尝试心理援助热线 12356；其他地区请拨打当地急救或心理援助电话。',
      ]
    : [
        '如果你有立即伤害自己的冲动，请不要独处，立刻拨打 110 或 120。',
        '联系一个能马上到你身边的人，或前往最近医院的急诊、精神心理科。',
        '中国大陆可尝试拨打全国心理援助热线 12356；其他地区请拨打当地急救或心理援助电话。',
      ]
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
        <h2 id="safety-title">先不谈牌，也不做解读</h2>
        <p id="safety-description" className="safety-lead">
          {kind === 'both'
            ? '你同时提到了伤害自己和他人的想法。现在最重要的是让所有人离开危险。'
            : harmToOthers
              ? '心镜不会为这类问题抽牌，也不会让模型继续解读；现在最重要的是让所有人离开危险。'
              : '心镜不会为这类问题抽牌，也不会让模型继续解读；现在最重要的是让你安全。'}
        </p>
        {querent && (
          <p className="safety-querent">
            {harmToOthers
              ? `如果这是替「${querent}」问的，请先确认对方和周围人的安全，并立即联系对方身边可信任的人或报警。`
              : `如果这是替「${querent}」问的，请先确认对方此刻是否安全，并联系对方身边可信任的人。`}
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
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>

        <p className="safety-close-note">
          {kind === 'both'
            ? '先让一个真实的人陪着你，直到这阵冲动过去。'
            : harmToOthers
              ? '先保证人身安全，其他事情可以稍后再处理。'
              : '你不需要一个人扛。先让一个真实的人知道你现在的情况。'}
        </p>
        <button type="button" className="ghost-btn safety-return" onClick={onClose}>
          我暂时安全，返回首页
        </button>
      </div>
    </div>
  )
}
