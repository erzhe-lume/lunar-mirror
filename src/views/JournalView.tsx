import { useEffect, useRef, useState } from 'react'
import type { JournalEntry, Settings } from '../types'
import { demoRevisit } from '../lib/demo'
import { formatDate } from '../lib/format'
import { requestRevisitNote } from '../lib/llm'
import { revisitsOf } from '../lib/revisits'
import CelestialEmpty from '../components/CelestialEmpty'
import InsightCard from '../components/InsightCard'
import RingTimeline, { RING_PAGE_SIZE } from '../components/RingTimeline'
import SealMark from '../components/SealMark'

interface Props {
  entries: JournalEntry[]
  settings: Settings
  onBack: () => void
  onUpdate: (entry: JournalEntry) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const pause = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms))

export default function JournalView({
  entries,
  settings,
  onBack,
  onUpdate,
  onDelete,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ringPage, setRingPage] = useState(0)
  const [previewId, setPreviewId] = useState<string | null>(
    entries[0]?.id ?? null,
  )
  const [revisitText, setRevisitText] = useState('')
  const [revisitBusy, setRevisitBusy] = useState(false)
  const [revisitError, setRevisitError] = useState('')
  const [revisitNotice, setRevisitNotice] = useState('')
  const revisitBusyRef = useRef(false)

  const selected = entries.find((entry) => entry.id === selectedId) ?? null

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [selectedId])

  useEffect(() => {
    const lastPage = Math.max(
      0,
      Math.ceil(entries.length / RING_PAGE_SIZE) - 1,
    )
    if (ringPage > lastPage) {
      setRingPage(lastPage)
      const first = entries[lastPage * RING_PAGE_SIZE]
      if (first) setPreviewId(first.id)
      return
    }
    if (!entries.some((entry) => entry.id === previewId)) {
      setPreviewId(entries[0]?.id ?? null)
    }
  }, [entries, ringPage, previewId])

  const openEntry = (entry: JournalEntry) => {
    setSelectedId(entry.id)
    setRevisitText('')
    setRevisitError('')
    setRevisitNotice('')
  }

  const changeRingPage = (next: number) => {
    const lastPage = Math.max(
      0,
      Math.ceil(entries.length / RING_PAGE_SIZE) - 1,
    )
    const page = Math.min(Math.max(next, 0), lastPage)
    setRingPage(page)
    const first = entries[page * RING_PAGE_SIZE]
    if (first) setPreviewId(first.id)
  }

  if (selected) {
    const submitRevisit = async () => {
      const answer = revisitText.trim()
      if (!answer || revisitBusyRef.current) return
      revisitBusyRef.current = true
      setRevisitBusy(true)
      setRevisitError('')
      setRevisitNotice('')
      try {
        let note: string
        if (settings.apiKey.trim() && !settings.offline) {
          try {
            note = await requestRevisitNote(settings, selected, answer)
          } catch {
            note = demoRevisit(selected, answer)
            setRevisitNotice('模型服务暂时不可用，这次回访已由本心模式生成。')
          }
        } else {
          await pause(650)
          note = demoRevisit(selected, answer)
        }
        await onUpdate({
          ...selected,
          revisits: [
            ...revisitsOf(selected),
            { at: Date.now(), answer, note },
          ],
        })
        setRevisitText('')
      } catch (error) {
        setRevisitError(
          error instanceof Error ? error.message : '回访失败，请再试一次。',
        )
      } finally {
        revisitBusyRef.current = false
        setRevisitBusy(false)
      }
    }

    const remove = async () => {
      if (!window.confirm('删除这条自省记录？此操作不可撤销。')) return
      await onDelete(selected.id)
      setSelectedId(null)
    }

    return (
      <section className="view journal-view">
        <header className="stage-head">
          <button type="button" className="text-btn" onClick={() => setSelectedId(null)}>
            ← 时间线
          </button>
          <div className="stage-question">
            <span className="eyebrow">
              {selected.querent
                ? `为「${selected.querent}」的照见`
                : '照见'}{' '}
              · {formatDate(selected.createdAt)}
            </span>
            <p>{selected.question}</p>
          </div>
          <button type="button" className="text-btn danger" onClick={() => void remove()}>
            删除
          </button>
        </header>

        <div className="journal-detail">
          <InsightCard
            insight={selected.insight}
            question={selected.question}
            querent={selected.querent}
            cards={selected.cards}
            createdAt={selected.createdAt}
            snapshot={selected.snapshot}
          />

          <details className="transcript">
            <summary>当时的对话 · {selected.messages.length} 段</summary>
            <div className="transcript-body">
              {selected.messages.map((message, index) => (
                <div
                  key={`${message.at}-${index}`}
                  className={`bubble-row ${message.role === 'user' ? 'is-user' : 'is-mirror'}`}
                >
                  {message.role === 'assistant' && (
                    <span className="bubble-avatar" aria-hidden="true">
                      <SealMark />
                    </span>
                  )}
                  <div className={`bubble ${message.role === 'user' ? 'bubble-user' : 'bubble-mirror'}`}>
                    {message.role === 'assistant' && (
                      <i className="bubble-veil" aria-hidden="true" />
                    )}
                    {message.content.split('\n').filter(Boolean).map((line, lineIndex) => (
                      <p key={lineIndex}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>

          <section className="revisit">
            <h3>回访</h3>
            {revisitsOf(selected).length > 0 && (
              <div className="revisit-history">
                {[...revisitsOf(selected)]
                  .reverse()
                  .map((item, index) => (
                    <div
                      className="revisit-record"
                      key={`${item.at}-${index}`}
                    >
                      <span className="eyebrow">
                        {formatDate(item.at)} 的你写道
                      </span>
                      <p className="revisit-answer">“{item.answer}”</p>
                      <div className="revisit-note">
                        <span className="bubble-avatar" aria-hidden="true">
                          <SealMark />
                        </span>
                        <p>{item.note}</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            <p className="revisit-question">
              {revisitsOf(selected).length > 0
                ? '隔一段时间，可以再回来写一次。每次回访都会留在下面，不会被覆盖。'
                : '现在回头看，当时的洞察应验了吗，或者悄悄改变了？隔一段时间回来写几句，会更有意思。'}
            </p>
            <textarea
              rows={3}
              value={revisitText}
              maxLength={400}
              placeholder="比如：那天说的‘把期待留给自己’，我后来真的做到了吗…"
              onChange={(event) => setRevisitText(event.target.value)}
              disabled={revisitBusy}
            />
            {revisitError && <p className="form-error">{revisitError}</p>}
            <button
              type="button"
              className="primary-btn small"
              onClick={() => void submitRevisit()}
              disabled={!revisitText.trim() || revisitBusy}
            >
              {revisitBusy ? '心镜正在读…' : '留下这次回访'}
            </button>
            {revisitNotice && <p className="form-notice">{revisitNotice}</p>}
          </section>
        </div>
      </section>
    )
  }

  return (
    <section className="view journal-view">
      <header className="stage-head">
        <button type="button" className="text-btn" onClick={onBack}>
          ← 首页
        </button>
        <div className="stage-question">
          <span className="eyebrow">你的自省时间线</span>
          <p>每一次照见，都留在时间里</p>
        </div>
        <span className="journal-count">{entries.length} 次</span>
      </header>

      {entries.length === 0 ? (
        <div className="journal-empty">
          <CelestialEmpty variant="timeline" />
          <h3>时间线还是空的</h3>
          <p>完成一次抽牌与对话后，你的自省记录会出现在这里，也可以日后回来回访。</p>
          <button type="button" className="primary-btn" onClick={onBack}>
            去抽一次牌
          </button>
        </div>
      ) : (
        <RingTimeline
          entries={entries}
          page={ringPage}
          previewId={previewId}
          onPageChange={changeRingPage}
          onPreview={setPreviewId}
          onOpen={openEntry}
        />
      )}
    </section>
  )
}
