import { useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type {
  JournalEntry,
  PrivateCard,
  TarotCard as TarotCardData,
} from '../types'
import { parseBackup } from '../lib/backup'
import { classifyTheme } from '../lib/demo'
import { formatShortDate } from '../lib/format'
import { revisitsOf } from '../lib/revisits'
import CelestialEmpty from '../components/CelestialEmpty'
import TarotCard from '../components/TarotCard'

interface Props {
  entries: JournalEntry[]
  privateCard: PrivateCard | null
  onBack: () => void
  onOpenJournal: () => void
  onOpenPrivateCard: () => void
  onImport: (
    entries: JournalEntry[],
    privateCard: PrivateCard | null,
  ) => Promise<{
    added: number
    updated: number
    privateCard: 'restored' | 'kept' | 'none'
  }>
}

const GENERIC_WORDS = new Set(['此刻', '变化', '选择', '自省', '换一个问题'])

function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () =>
      reject(reader.error ?? new Error('读取备份文件失败。'))
    reader.readAsText(file)
  })
}

export default function MirrorView({
  entries,
  privateCard,
  onBack,
  onOpenJournal,
  onOpenPrivateCard,
  onImport,
}: Props) {
  const [exported, setExported] = useState(false)
  const [now] = useState(() => Date.now())
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<{
    tone: 'ok' | 'error'
    text: string
  } | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

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
      : now
    const days = Math.max(1, Math.ceil((now - oldest) / 86400000))

    return {
      themeList,
      keywordList,
      cardList,
      revisits,
      forOthers,
      oldest,
      days,
    }
  }, [entries, now])

  const letter = useMemo(() => {
    if (entries.length === 0) return []
    const lines: string[] = []
    const single = entries.length === 1
    lines.push(
      `从${formatShortDate(stats.oldest)}到今天，你在月鉴前留下了 ${entries.length} 次照见。`,
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
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 2,
            exportedAt: Date.now(),
            entries,
            privateCard,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `lunar-mirror-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setExported(true)
    window.setTimeout(() => setExported(false), 2000)
  }

  const chooseBackup = () => {
    if (importing) return
    fileRef.current?.click()
  }

  const importBackup = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      setImportStatus({ tone: 'error', text: '备份文件超过 15MB，无法导入。' })
      return
    }
    setImporting(true)
    setImportStatus(null)
    try {
      const parsed = parseBackup(await readFileText(file))
      if (parsed.entries.length === 0) {
        throw new Error('备份里没有找到可恢复的记录。')
      }
      const existing = new Set(entries.map((entry) => entry.id))
      const conflicts = parsed.entries.filter((entry) =>
        existing.has(entry.id),
      ).length
      if (
        conflicts > 0 &&
        !window.confirm(
          `有 ${conflicts} 条记录已经存在，导入会用备份中的版本覆盖它们。继续吗？`,
        )
      ) {
        return
      }
      const result = await onImport(parsed.entries, parsed.privateCard)
      const details = [
        parsed.skipped > 0 ? `跳过 ${parsed.skipped} 条无法识别的记录` : '',
        parsed.snapshotsDropped > 0
          ? `忽略 ${parsed.snapshotsDropped} 张超大快照`
          : '',
        result.privateCard === 'restored'
          ? '已恢复你的第79张'
          : result.privateCard === 'kept'
            ? '本机已有第79张，保留本机版本'
            : '',
      ].filter(Boolean)
      setImportStatus({
        tone: 'ok',
        text: `已恢复 ${result.added} 条，更新 ${result.updated} 条${
          details.length > 0 ? `；${details.join('，')}` : ''
        }。`,
      })
    } catch (caught) {
      setImportStatus({
        tone: 'error',
        text: caught instanceof Error ? caught.message : '导入失败，请重试。',
      })
    } finally {
      setImporting(false)
    }
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

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json,text/plain"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void importBackup(file)
        }}
      />

      {importStatus && (
        <p
          className={`mirror-import-status is-${importStatus.tone}`}
          role={importStatus.tone === 'error' ? 'alert' : 'status'}
        >
          {importStatus.text}
        </p>
      )}

      {entries.length === 0 ? (
        <div className="journal-empty">
          <CelestialEmpty variant="mirror" />
          <h3>镜面还在等待第一道光</h3>
          <p>
            完成一次抽牌与对话后，这里会把散落的记录连成一条路：反复出现的主题、词和牌。
          </p>
          <div className="journal-empty-actions">
            <button type="button" className="primary-btn" onClick={onBack}>
              去抽一次牌
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={chooseBackup}
              disabled={importing}
            >
              {importing ? '正在恢复…' : '从备份恢复'}
            </button>
          </div>
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
            <p className="letter-coda">镜面不替你判断，只把重复照亮。</p>
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
                onClick={chooseBackup}
                disabled={importing}
              >
                {importing ? '正在恢复…' : '导入记录'}
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
            {privateCard && (
              <button
                type="button"
                className="mirror-block mirror-private-block"
                onClick={onOpenPrivateCard}
              >
                <span className="eyebrow">你的第79张</span>
                <strong>{privateCard.name}</strong>
                <span>查看我的牌 →</span>
              </button>
            )}
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
