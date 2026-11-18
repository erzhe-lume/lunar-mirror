import { useRef, useState } from 'react'
import type { DrawnCard, Insight } from '../types'
import { POSITIONS } from '../types'
import { formatDate } from '../lib/format'
import { downloadInsightImage } from '../lib/share'
import { composeVerse } from '../lib/verse'
import TarotCard from './TarotCard'

interface Props {
  insight: Insight
  question: string
  querent?: string
  cards: DrawnCard[]
  createdAt?: number
  snapshot?: string
  showCards?: boolean
}

export default function InsightCard({
  insight,
  question,
  querent,
  cards,
  createdAt,
  snapshot,
  showCards = true,
}: Props) {
  const verse = composeVerse(insight, cards)
  const [shareState, setShareState] = useState<{
    status: 'idle' | 'saving' | 'saved' | 'error'
    format: 'poster' | 'story'
  }>({ status: 'idle', format: 'poster' })
  const savingRef = useRef(false)

  const saveImage = async (format: 'poster' | 'story') => {
    if (savingRef.current) return
    savingRef.current = true
    setShareState({ status: 'saving', format })
    try {
      await downloadInsightImage(
        {
          insight,
          question,
          querent,
          cards,
          createdAt,
          verse,
        },
        format,
      )
      setShareState({ status: 'saved', format })
      window.setTimeout(
        () => setShareState({ status: 'idle', format }),
        2400,
      )
    } catch {
      setShareState({ status: 'error', format })
      window.setTimeout(
        () => setShareState({ status: 'idle', format }),
        2600,
      )
    } finally {
      savingRef.current = false
    }
  }

  const shareLabel = (format: 'poster' | 'story') => {
    if (shareState.status === 'saving' && shareState.format === format) {
      return '正在显影…'
    }
    if (shareState.status === 'saved' && shareState.format === format) {
      return '已保存'
    }
    if (shareState.status === 'error' && shareState.format === format) {
      return '生成失败，重试'
    }
    return format === 'story' ? '竖版 9:16' : '保存签文图'
  }

  const saving = shareState.status === 'saving'

  return (
    <article className="insight-card ornate-corners">
      <header className="insight-head">
        <div className="insight-meta">
          <span className="eyebrow">
            自省记录{createdAt ? ` · ${formatDate(createdAt)}` : ''}
          </span>
          <h2>{insight.title}</h2>
          <p className="insight-question">
            {querent ? `「${querent}」问的是` : '你问的是'}：「{question}」
          </p>
        </div>
        {snapshot && (
          <figure className="insight-snapshot">
            <img src={snapshot} alt="当时的心情快照" />
            <figcaption>那天的你</figcaption>
          </figure>
        )}
      </header>

      <blockquote className="insight-mirror">{insight.mirror}</blockquote>

      <div className="oracle-verse">
        <span className="oracle-verse-label">牌面签文</span>
        {verse.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>

      {insight.crisis ? (
        <p className="insight-crisis-note">
          此刻先不解读牌面。请优先保护自己和他人的安全：有立即危险拨打 110，有人受伤拨打
          120；中国大陆可尝试心理援助热线 12356。
        </p>
      ) : (
        showCards && (
          <div className="insight-cards">
            {cards.map((drawn) => (
              <div className="insight-card-item" key={drawn.position}>
                <span className="eyebrow">{POSITIONS[drawn.position].label}</span>
                <TarotCard
                  card={drawn.card}
                  orientation={drawn.orientation}
                  faceUp
                  size="sm"
                />
                <span className="insight-card-name">
                  {drawn.card.name} · {drawn.orientation === 'upright' ? '正位' : '逆位'}
                </span>
              </div>
            ))}
          </div>
        )
      )}

      <div className="insight-sections">
        <section>
          <h4>反复出现的模式</h4>
          <p>{insight.pattern}</p>
        </section>
        <section>
          <h4>一个小小的邀请</h4>
          <p>{insight.invitation}</p>
        </section>
      </div>

      {insight.keywords.length > 0 && (
        <div className="keyword-row">
          {insight.keywords.map((keyword, index) => (
            <span
              className="keyword-chip"
              key={`${keyword}-${index}`}
            >
              {keyword}
            </span>
          ))}
        </div>
      )}

      <div className="insight-tools">
        <button
          type="button"
          className="ghost-btn small"
          onClick={() => void saveImage('poster')}
          disabled={saving}
        >
          {shareLabel('poster')}
        </button>
        <button
          type="button"
          className="ghost-btn small"
          onClick={() => void saveImage('story')}
          disabled={saving}
        >
          {shareLabel('story')}
        </button>
        <span>4:5 / 9:16 · 只在本机生成</span>
      </div>
    </article>
  )
}
