import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { JournalEntry, TarotCard as TarotCardData } from '../types'
import { classifyTheme } from '../lib/demo'
import { formatShortDate } from '../lib/format'
import { revisitsOf } from '../lib/revisits'
import CelestialEmpty from '../components/CelestialEmpty'
import TarotCard from '../components/TarotCard'

interface Props {
  entries: JournalEntry[]
  onBack: () => void
  onOpenJournal: () => void
}

const GENERIC_WORDS = new Set(['此刻', '变化', '选择', '自省', '换一个问题'])

export default function MirrorView({ entries, onBack, onOpenJournal }: Props) {
  const [exported, setExported] = useState(false)

  const stats = useMemo(() => {
    const themes = new Map<string, { label: string; count: number }>()
    const keywords = new Map<string, number>()
    const cards = new Map<
      number,
      { card: TarotCardData; name: string; symbol: string; count: number }
    >()
    let revisits = 0
    let forOthers = 0

    entries.forEach((entry) => {
      const profile = classifyTheme(entry.question)
      const theme = themes.get(profile.key) ?? { label: profile.label, count: 0 }
      theme.count += 1
      themes.set(profile.key, theme)

      entry.insight.keywords.forEach((word) => {
        if (GENERIC_WORDS.has(word)) return
        keywords.set(word, (keywords.get(word) ?? 0) + 1)
      })

      entry.cards.forEach((drawn) => {
        const card = cards.get(drawn.card.id) ?? {
          card: drawn.card,
          name: drawn.card.name,
          symbol: drawn.card.symbol,
          count: 0,
        }
        card.count += 1
        cards.set(drawn.card.id, card)
      })

      revisits += revisitsOf(entry).length
      if (entry.querent) forOthers += 1
    })

    const themeList = [...themes.values()].sort((a, b) => b.count - a.count)
    const keywordList = [...keywords.entries()]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
    const cardList = [...cards.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
    const oldest = entries.length
      ? entries[entries.length - 1].createdAt
      : Date.now()
    const days = Math.max(1, Math.ceil((Date.now() - oldest) / 86400000))

    return {
      themeList,
      keywordList,
      cardList,
      revisits,
      forOthers,
      oldest,
      days,
    }
  }, [entries])

  const letter = useMemo(() => {
    if (entries.length === 0) return []
    const lines: string[] = []
    const single = entries.length === 1
    lines.push(
      `从${formatShortDate(stats.oldest)}到今天，你在心镜前留下了 ${entries.length} 次照见。`,
    )
    if (stats.forOthers > 0) {
      lines.push(`其中 ${stats.forOthers} 次，你没有只问自己。`)
    }
    if (stats.themeList.length > 0) {
      lines.push(
        `${single ? '你这次停下来的地方，是' : '你最常停下来的地方，是'}「${stats.themeList
          .slice(0, single ? 1 : 2)
          .map((theme) => theme.label)
          .join('」和「')}」。`,
      )
    }
    if (stats.keywordList.length > 0) {
      lines.push(
        single
          ? `这次留下的词是「${stats.keywordList
              .slice(0, 3)
              .map((item) => item.word)
              .join('」「')}」。`
          : `「${stats.keywordList
              .slice(0, 3)
              .map((item) => item.word)
              .join('」「')}」在你的记录里反复出现。`,
      )
    }
    const topCard = stats.cardList[0]
    if (topCard && topCard.count > 1) {
      lines.push(
        `《${topCard.name}》出现了 ${topCard.count} 次，像在反复提醒你同一件事。`,
      )
    }
    if (stats.revisits > 0) {
      lines.push(
        `你回来回访过 ${stats.revisits} 次。愿意回头看，本身就是一种力量。`,
      )
    }
    if (single) {
      lines.push('现在只有一次照见，镜面还在显影，不必急着看出规律。')
    } else {
      lines.push('这不是重复，而是你在同一扇门前，敲了不同的次数。')
    }
    lines.push(
      '下一次抽牌，可以带着这个问题：如果这次不再问“怎么办”，你想问什么？',
    )
    if (entries.length < 3) {
      lines.push('镜面还在显影——再留下一两次照见，它会看得更清楚。')
    }
    return lines
  }, [entries.length, stats])

  const exportRecords = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mirror-arcana-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setExported(true)
    window.setTimeout(() => setExported(false), 2000)
  }

  return (
    <section className="view mirror-view">
      <header className="stage-head">
        <button type="button" className="text-btn" onClick={onBack}>
          ← 首页
        </button>
        <div className="stage-question">
          <span className="eyebrow">镜面档案</span>
          <p>把许多次照见，看成一条路</p>
        </div>
        <span className="journal-count">{entries.length} 次照见</span>
      </header>

      {entries.length === 0 ? (
        <div className="journal-empty">
          <CelestialEmpty variant="mirror" />
          <h3>镜面还在等待第一道光</h3>
          <p>
            完成一次抽牌与对话后，这里会把散落的记录连成一条路：反复出现的主题、词和牌。
          </p>
          <button type="button" className="primary-btn" onClick={onBack}>
            去抽一次牌
          </button>
        </div>
      ) : (
        <div className="mirror-grid">
          <article className="mirror-letter ornate-corners">
            <span className="letter-seal" aria-hidden="true">
              ✦
            </span>
            <span className="eyebrow">镜面来信</span>
            <h2>写给此刻的你</h2>
            <div className="letter-body">
              {letter.map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
            <div className="mirror-actions">
              <button
                type="button"
                className="ghost-btn small"
                onClick={exportRecords}
              >
                {exported ? '已导出' : '导出原始记录'}
              </button>
              <button
                type="button"
                className="ghost-btn small"
                onClick={onOpenJournal}
              >
                查看时间线
              </button>
            </div>
          </article>

          <aside className="mirror-aside">
            <section className="mirror-block">
              <h3>
                {entries.length === 1
                  ? '这次停下来的地方'
                  : '你反复停留的地方'}
              </h3>
              <div className="theme-bars">
                {stats.themeList.map((theme, index) => (
                  <div
                    className="theme-row"
                    key={theme.label}
                    style={{ '--i': index } as CSSProperties}
                  >
                    <span className="theme-label">{theme.label}</span>
                    <span className="theme-track">
                      <i
                        style={{
                          width: `${Math.max(
                            8,
                            (theme.count / (stats.themeList[0]?.count || 1)) * 100,
                          )}%`,
                        }}
                      />
                    </span>
                    <span className="theme-count">{theme.count}</span>
                  </div>
                ))}
              </div>
            </section>

            {stats.keywordList.length > 0 && (
              <section className="mirror-block">
                <h3>
                  {entries.length === 1 ? '这次留下的词' : '反复出现的词'}
                </h3>
                <div className="mirror-cloud">
                  {stats.keywordList.map((item, index) => (
                    <span
                      key={item.word}
                      style={
                        {
                          '--i': index,
                          fontSize: `${12 + Math.min(item.count, 4) * 2}px`,
                        } as CSSProperties
                      }
                    >
                      {item.word}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {stats.cardList.length > 0 && (
              <section className="mirror-block">
                <h3>
                  {entries.length === 1 ? '这次出现的牌' : '反复出现的牌'}
                </h3>
                <div className="mirror-cards">
                  {stats.cardList.map((card) => (
                    <div className="mirror-card-stat" key={card.card.id}>
                      <span className="mirror-card-thumb" aria-hidden="true">
                        <TarotCard card={card.card} faceUp size="xs" />
                      </span>
                      <div>
                        <strong>{card.name}</strong>
                        <span>出现 {card.count} 次</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mirror-block mirror-meta">
              <div>
                <strong>{entries.length}</strong>
                <span>次照见</span>
              </div>
              <div>
                <strong>{stats.revisits}</strong>
                <span>次回访</span>
              </div>
              <div>
                <strong>{stats.forOthers}</strong>
                <span>次为他人</span>
              </div>
              <div>
                <strong>{stats.days}</strong>
                <span>天</span>
              </div>
            </section>
          </aside>
        </div>
      )}
    </section>
  )
}
