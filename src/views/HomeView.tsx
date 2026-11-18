import { useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { JournalEntry, Settings } from '../types'
import { MAJOR_ARCANA } from '../data/tarot'
import { formatShortDate } from '../lib/format'
import Astrolabe from '../components/Astrolabe'
import CameraModal from '../components/CameraModal'
import CelestialArch from '../components/CelestialArch'
import TarotCard from '../components/TarotCard'

interface Props {
  settings: Settings
  latestEntry?: JournalEntry
  onStart: (question: string, snapshot?: string, querent?: string) => void
  onOpenJournal: () => void
  onOpenSettings: () => void
}

const STAR_CARD = MAJOR_ARCANA.find((card) => card.id === 17) ?? MAJOR_ARCANA[0]
const HERO_OFFSETS = [-4, -3, -2, -1, 0, 1, 2, 3, 4]

export default function HomeView({
  settings,
  latestEntry,
  onStart,
  onOpenJournal,
  onOpenSettings,
}: Props) {
  const [question, setQuestion] = useState('')
  const [snapshot, setSnapshot] = useState<string | undefined>()
  const [cameraOpen, setCameraOpen] = useState(false)
  const [forOther, setForOther] = useState(false)
  const [querent, setQuerent] = useState('')
  const homeRef = useRef<HTMLElement | null>(null)
  const offline = !settings.apiKey.trim() || settings.offline

  const start = () => {
    const trimmed = question.trim()
    if (!trimmed) return
    onStart(
      trimmed,
      snapshot,
      forOther ? querent.trim() || '一位朋友' : undefined,
    )
  }

  const startBlank = () => {
    const person = forOther ? querent.trim() || 'TA' : '我'
    onStart(
      `此刻，${person}最需要看见的是什么？`,
      snapshot,
      forOther ? querent.trim() || '一位朋友' : undefined,
    )
  }

  const focusQuestion = () => {
    document.getElementById('home-question')?.focus()
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const node = homeRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1
    node.style.setProperty('--mx', x.toFixed(3))
    node.style.setProperty('--my', y.toFixed(3))
  }

  return (
    <section
      className="view home-view"
      ref={homeRef}
      onPointerMove={handlePointerMove}
    >
      <div className="hero">
        <div className="hero-sanctum" aria-hidden="true">
          <div className="hero-astrolabe">
            <Astrolabe />
          </div>
          <CelestialArch />
        </div>
        <div className="hero-fan" aria-hidden="true">
          {HERO_OFFSETS.map((offset) => (
            <div
              className={`hero-fan-card ${offset === 0 ? 'is-center' : ''}`}
              key={offset}
              style={
                {
                  '--offset': offset,
                  '--rot': `${offset * 6.4}deg`,
                  '--lift': `${Math.abs(offset) ** 1.55 * 4.4}px`,
                  zIndex: 20 - Math.abs(offset),
                } as CSSProperties
              }
            >
              <div
                className="hero-card-float"
                style={{ animationDelay: `${Math.abs(offset) * 0.42}s` }}
              >
                {offset === 0 ? (
                  <TarotCard card={STAR_CARD} faceUp size="md" />
                ) : (
                  <TarotCard size="sm" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="hero-copy">
          <span className="hero-eyebrow">Mirror Arcana · 塔罗自省</span>
          <h1 className="hero-title">心镜</h1>
          <span className="hero-divider" aria-hidden="true">
            <i />
          </span>
          <p className="hero-line">不是预言，是一面镜子。</p>
          <p className="hero-sub">
            抽三张牌，和此刻的自己谈一谈。答案不必来自牌面，它可以先从你这里浮现。
          </p>
          <p className="hero-ritual" aria-hidden="true">
            <span>问一息</span>
            <i />
            <span>抽三张</span>
            <i />
            <span>谈一会儿</span>
          </p>
        </div>
      </div>

      <div className="home-lower">
        <div className="ask-panel ornate-corners">
        <span className="ask-mist" aria-hidden="true" />
        <span className="ask-watermark" aria-hidden="true">问</span>
        <span className="ask-ornament ask-ornament-tl" aria-hidden="true">✦</span>
        <span className="ask-ornament ask-ornament-br" aria-hidden="true">✦</span>
        <div className="ask-head">
          <span className="ask-kicker">THE QUESTION · 问</span>
          <span className="ask-rule" />
          <span className="ask-mark" aria-hidden="true">✦</span>
        </div>
        <div className="querent-row">
          <span className="querent-label">牌阵为谁而开</span>
          <div className="querent-tabs">
            <button
              type="button"
              className={!forOther ? 'is-active' : ''}
              onClick={() => setForOther(false)}
            >
              自己
            </button>
            <button
              type="button"
              className={forOther ? 'is-active' : ''}
              onClick={() => setForOther(true)}
            >
              他人
            </button>
          </div>
          {forOther && (
            <input
              className="querent-input"
              value={querent}
              maxLength={16}
              placeholder="TA 的名字或称呼"
              aria-label="问卜者的名字或称呼"
              onChange={(event) => setQuerent(event.target.value)}
            />
          )}
        </div>
        <label className="ask-label" htmlFor="home-question">
          此刻，有什么在你心里打转？
        </label>
        <textarea
          id="home-question"
          className="ask-input"
          rows={3}
          maxLength={200}
          value={question}
          placeholder="比如：我该不该换一份工作？为什么我总在关系里退让？"
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) start()
          }}
        />
        <div className="ask-tools">
          <div className="ask-tools-left">
            <button
              type="button"
              className="ghost-btn small"
              onClick={() => setCameraOpen(true)}
            >
              <span className="camera-glyph">◐</span>
              心情快照
            </button>
            {snapshot && (
              <span className="snapshot-chip">
                <img src={snapshot} alt="已拍摄的心情快照" />
                已留下快照
                <button
                  type="button"
                  className="chip-remove"
                  onClick={() => setSnapshot(undefined)}
                  aria-label="移除快照"
                >
                  ×
                </button>
              </span>
            )}
          </div>
          <span className="char-count">{question.length}/200</span>
        </div>
        <button
          type="button"
          className="primary-btn ask-submit"
          onClick={start}
          disabled={!question.trim()}
        >
          <span className="cta-star" aria-hidden="true">✦</span>
          <span>洗牌 · 抽三张</span>
          <span className="cta-star" aria-hidden="true">✦</span>
        </button>
        {offline && (
          <p className="mode-note">
            本心模式：牌面给出几种声音，没有唯一答案；抽牌、追问、自省记录与回访都在本地完成。
            <button type="button" className="inline-link" onClick={onOpenSettings}>
              打开设置
            </button>
            可接入千问、Claude、Gemini 或你的网关，获得实时对话。
          </p>
        )}
      </div>

        <aside className="home-aside">
          <button
            type="button"
            className="home-aside-note home-aside-blank"
            onClick={startBlank}
          >
            <span className="eyebrow">留一个空白</span>
            <p>
              如果暂时没有问题，也可以先闭上眼睛，让第一张牌替你说出心里那句话。
            </p>
            <span className="blank-action">
              <span>不用问题，直接抽牌</span>
              <i aria-hidden="true" />
              <span aria-hidden="true">→</span>
            </span>
          </button>
          {latestEntry && (
            <button type="button" className="latest-card" onClick={onOpenJournal}>
              <span className="eyebrow">
                上一次照见 · {formatShortDate(latestEntry.createdAt)}
              </span>
              <p className="latest-quote">“{latestEntry.insight.mirror}”</p>
              <span className="latest-link">回到时间线 →</span>
            </button>
          )}
          <div className="home-aside-note home-aside-quote">
            <span className="eyebrow">心镜的规矩</span>
            <p>
              不预言命运，不替你决定。牌面只是把问题摆得久一点，让你看清自己站在哪里。
            </p>
            <button type="button" className="inline-link" onClick={focusQuestion}>
              写下第一个问题 →
            </button>
          </div>
        </aside>
      </div>

      <p className="privacy-note">对话与快照只保存在你的浏览器本机，不上传服务器。</p>

      <CameraModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(dataUrl) => setSnapshot(dataUrl)}
      />
    </section>
  )
}
