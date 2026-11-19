import { useEffect, useRef, useState } from 'react'
import type {
  ChatMessage,
  DrawnCard,
  Insight,
  JournalEntry,
  Settings,
} from '../types'
import { POSITIONS } from '../types'
import {
  classifyTheme,
  demoInsight,
  demoOpening,
  demoReply,
  demoSuggestions,
} from '../lib/demo'
import {
  detectSafetyConcern,
  isCrisisText,
  type SafetyKind,
} from '../lib/crisis'
import { SAFETY_COPY } from '../data/safety-copy'
import {
  LlmCancelledError,
  requestInsight,
  requestOpening,
  requestReply,
} from '../lib/llm'
import { READING_LENSES, type ReadingLens } from '../lib/lenses'
import { shapeReading } from '../lib/reading'
import { playInsight } from '../lib/sound'
import { speak, stopSpeaking } from '../lib/speech'
import {
  loadReadingSnapshot,
  saveReadingSnapshot,
} from '../lib/storage'
import InsightCard from '../components/InsightCard'
import SealMark from '../components/SealMark'
import TarotCard from '../components/TarotCard'

interface Props {
  settings: Settings
  question: string
  querent?: string
  snapshot?: string
  cards: DrawnCard[]
  onSaved: (entry: JournalEntry) => void
  onHome: () => void
  onJournal: () => void
}

type Pending =
  | { kind: 'opening' }
  | { kind: 'reply'; history: ChatMessage[]; lens?: ReadingLens }
  | { kind: 'insight' }

const pause = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms))

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '出了点问题，请再试一次。'
}

export default function ReadingView({
  settings,
  question,
  querent,
  snapshot,
  cards,
  onSaved,
  onHome,
  onJournal,
}: Props) {
  const [restored] = useState(() => loadReadingSnapshot(question, cards))
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => restored?.messages ?? [],
  )
  const [input, setInput] = useState(() => restored?.input ?? '')
  const [busy, setBusy] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<'chat' | 'insight'>(
    () => restored?.phase ?? 'chat',
  )
  const [insight, setInsight] = useState<Insight | null>(
    () => restored?.insight ?? null,
  )
  const [savedEntry, setSavedEntry] = useState<JournalEntry | null>(
    () => restored?.savedEntry ?? null,
  )
  const [ttsOn, setTtsOn] = useState(settings.voiceEnabled)
  const [offlineMode, setOfflineMode] = useState(
    !settings.apiKey.trim() || settings.offline,
  )
  const [showJump, setShowJump] = useState(false)

  const pendingRef = useRef<Pending | null>(null)
  const startedRef = useRef(false)
  const restoredSavedRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const ttsRef = useRef(settings.voiceEnabled)
  const offlineRef = useRef(!settings.apiKey.trim() || settings.offline)
  const busyRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const atBottomRef = useRef(true)

  const setBusyState = (value: boolean) => {
    busyRef.current = value
    setBusy(value)
  }

  const isLocal = () =>
    offlineRef.current || !settings.apiKey.trim() || settings.offline
  const offlineLabel = offlineMode || isLocal()

  useEffect(() => {
    ttsRef.current = ttsOn
  }, [ttsOn])

  useEffect(() => {
    if (!settings.apiKey.trim() || settings.offline) {
      offlineRef.current = true
      setOfflineMode(true)
    }
  }, [settings.apiKey, settings.offline])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      stopSpeaking()
    }
  }, [])

  useEffect(() => {
    if (busy) return
    const timer = window.setTimeout(() => {
      saveReadingSnapshot({
        question,
        cards,
        messages,
        input,
        phase,
        insight,
        savedEntry,
      })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [question, cards, messages, input, phase, insight, savedEntry, busy])

  useEffect(() => {
    if (restoredSavedRef.current) return
    restoredSavedRef.current = true
    if (restored?.phase === 'insight' && restored.savedEntry) {
      onSaved(restored.savedEntry)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    if (messages.length <= 1 && messages[0]?.role === 'assistant') {
      node.scrollTop = 0
      return
    }
    if (atBottomRef.current) node.scrollTop = node.scrollHeight
  }, [messages, busy, error])

  useEffect(() => {
    if (phase === 'insight' && settings.soundEnabled) playInsight()
  }, [phase, settings.soundEnabled])

  useEffect(() => {
    if (phase === 'insight') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      if (window.location.hash !== '#/reading/insight') {
        window.history.replaceState(
          { view: 'reading', phase: 'insight' },
          '',
          '#/reading/insight',
        )
      }
    } else if (window.location.hash.startsWith('#/reading/')) {
      window.history.replaceState(
        { view: 'reading', phase: 'chat' },
        '',
        '#/reading',
      )
    }
  }, [phase])

  const appendAssistant = (content: string) => {
    setMessages((previous) => [
      ...previous,
      { role: 'assistant', content, at: Date.now() },
    ])
    if (ttsRef.current) speak(content, settings.voiceURI)
  }

  const handleChatScroll = () => {
    const node = scrollRef.current
    if (!node) return
    const atBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight < 72
    atBottomRef.current = atBottom
    setShowJump(!atBottom)
  }

  const jumpToLatest = () => {
    const node = scrollRef.current
    if (!node) return
    atBottomRef.current = true
    setShowJump(false)
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }

  const beginStream = () => {
    const at = Date.now()
    let inserted = false
    let latest = ''
    let frame = 0

    const paint = () => {
      frame = 0
      setMessages((previous) =>
        previous.map((message, index) =>
          index === previous.length - 1 && message.at === at
            ? { ...message, content: latest }
            : message,
        ),
      )
    }

    return {
      onDelta: (full: string) => {
        latest = full
        if (!inserted) {
          inserted = true
          setStreaming(true)
          setMessages((previous) => [
            ...previous,
            { role: 'assistant', content: latest, at },
          ])
          return
        }
        if (!frame) frame = window.requestAnimationFrame(paint)
      },
      finish: (full: string) => {
        if (frame) window.cancelAnimationFrame(frame)
        setStreaming(false)
        if (!inserted) {
          appendAssistant(full)
          return
        }
        setMessages((previous) =>
          previous.map((message, index) =>
            index === previous.length - 1 && message.at === at
              ? { ...message, content: full }
              : message,
          ),
        )
        if (ttsRef.current) speak(full, settings.voiceURI)
      },
      cancel: () => {
        if (frame) window.cancelAnimationFrame(frame)
        setStreaming(false)
        if (inserted) {
          setMessages((previous) =>
            previous.filter(
              (message) =>
                !(message.at === at && message.role === 'assistant'),
            ),
          )
        }
      },
      stop: () => {
        if (frame) window.cancelAnimationFrame(frame)
        setStreaming(false)
        if (!inserted) return
        const final = latest.trim()
        if (!final) {
          setMessages((previous) =>
            previous.filter(
              (message) =>
                !(message.at === at && message.role === 'assistant'),
            ),
          )
          return
        }
        const content = /[。！？!?…]$/.test(final) ? final : `${final}……`
        setMessages((previous) =>
          previous.map((message, index) =>
            index === previous.length - 1 && message.at === at
              ? { ...message, content }
              : message,
          ),
        )
      },
    }
  }

  const runOpening = async () => {
    if (cards.length === 0 || busyRef.current) return
    setBusyState(true)
    setError('')
    pendingRef.current = { kind: 'opening' }
    const controller = new AbortController()
    abortRef.current = controller
    const stream = beginStream()
    try {
      let content: string
      if (isCrisisText(question)) {
        content = demoOpening(question, cards, querent)
      } else if (!isLocal()) {
        content = await requestOpening(settings, question, cards, querent, {
          onDelta: stream.onDelta,
          signal: controller.signal,
        })
      } else {
        await pause(700)
        content = demoOpening(question, cards, querent)
      }
      stream.finish(shapeReading(content, 'opening'))
      pendingRef.current = null
    } catch (caught) {
      if (caught instanceof LlmCancelledError) {
        stream.stop()
        pendingRef.current = null
      } else {
        stream.cancel()
        setError(errorMessage(caught))
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setBusyState(false)
    }
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    if (restored?.messages.length) return
    void runOpening()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runReply = async (history: ChatMessage[], lens?: ReadingLens) => {
    if (busyRef.current) return
    setBusyState(true)
    setError('')
    pendingRef.current = { kind: 'reply', history, lens }
    const controller = new AbortController()
    abortRef.current = controller
    const stream = beginStream()
    try {
      let content: string
      const conversationCrisis = history.some(
        (message) => message.role === 'user' && isCrisisText(message.content),
      )
      if (conversationCrisis) {
        content = demoReply(question, cards, history, lens)
      } else if (!isLocal()) {
        content = await requestReply(settings, question, cards, history, {
          onDelta: stream.onDelta,
          signal: controller.signal,
          lens,
        })
      } else {
        await pause(650)
        content = demoReply(question, cards, history, lens)
      }
      stream.finish(shapeReading(content, 'reply'))
      pendingRef.current = null
    } catch (caught) {
      if (caught instanceof LlmCancelledError) {
        stream.stop()
        pendingRef.current = null
      } else {
        stream.cancel()
        setError(errorMessage(caught))
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setBusyState(false)
    }
  }

  const sendText = (raw: string) => {
    const text = raw.trim()
    if (!text || busyRef.current || phase !== 'chat') return
    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      at: Date.now(),
    }
    const next = [...messages, userMessage]
    setMessages(next)
    setInput('')
    atBottomRef.current = true
    setShowJump(false)
    saveReadingSnapshot({
      question,
      cards,
      messages: next,
      input: '',
      phase,
      insight,
      savedEntry,
    })
    void runReply(next)
  }

  const send = () => sendText(input)
  const userTurns = messages.filter((message) => message.role === 'user').length
  const suggestions = demoSuggestions(question)
  const isGriefReading = classifyTheme(question).key === 'grief'

  const finish = async () => {
    if (
      busyRef.current ||
      !messages.some((message) => message.role === 'assistant')
    ) {
      return
    }
    setBusyState(true)
    setGenerating(true)
    setError('')
    pendingRef.current = { kind: 'insight' }
    try {
      let result: Insight
      const conversationCrisis = messages.some(
        (message) => message.role === 'user' && isCrisisText(message.content),
      )
      if (conversationCrisis) {
        result = demoInsight(question, cards, messages)
      } else if (!isLocal()) {
        result = await requestInsight(settings, question, cards, messages, querent)
      } else {
        await pause(850)
        result = demoInsight(question, cards, messages)
      }
      const entry: JournalEntry = {
        id:
          typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: Date.now(),
        question,
        querent,
        cards,
        messages,
        insight: result,
        snapshot,
      }
      setInsight(result)
      setSavedEntry(entry)
      onSaved(entry)
      stopSpeaking()
      setPhase('insight')
      pendingRef.current = null
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusyState(false)
      setGenerating(false)
    }
  }

  const changeReading = (lens: ReadingLens) => {
    if (busyRef.current || phase !== 'chat') return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant') return
    const base = messages.slice(0, -1)
    if (!base.some((message) => message.role === 'user')) return
    setMessages(base)
    void runReply(base, lens)
  }

  const stopGenerating = () => {
    abortRef.current?.abort()
  }

  const retry = () => {
    const pending = pendingRef.current
    if (!pending || busyRef.current) return
    if (pending.kind === 'opening') void runOpening()
    else if (pending.kind === 'reply') {
      void runReply(pending.history, pending.lens)
    } else void finish()
  }

  const fallbackOffline = () => {
    if (busyRef.current) return
    offlineRef.current = true
    setOfflineMode(true)
    setError('')
    retry()
  }

  const crisisKind =
    detectSafetyConcern(question) ??
    messages
      .filter((message) => message.role === 'user')
      .map((message) => detectSafetyConcern(message.content))
      .find((kind): kind is SafetyKind => Boolean(kind)) ??
    null
  const safetyContent = crisisKind ? SAFETY_COPY[crisisKind] : null
  const crisisInChat =
    Boolean(crisisKind) ||
    isCrisisText(question) ||
    messages.some(
      (message) => message.role === 'user' && isCrisisText(message.content),
    )

  return (
    <section className={`view reading-view ${crisisInChat ? 'is-crisis' : ''}`}>
      <header className="stage-head reading-head">
        <button type="button" className="text-btn" onClick={onHome}>
          ← 首页
        </button>
        <div className="stage-question">
          <span className="eyebrow">
            {querent ? `为「${querent}」的牌阵` : '你的问题'}
          </span>
          <p>{question}</p>
        </div>
        <button type="button" className="text-btn" onClick={onJournal}>
          时间线 →
        </button>
      </header>

      {phase === 'chat' ? (
        <div className="reading-grid">
          <aside className="spread-summary" aria-label="本次牌阵">
            <div className="spread-head">
              <span className="eyebrow summary-title">本次牌阵</span>
              <span className="spread-count">III</span>
            </div>
            <div className="spread-fan" aria-hidden="true">
              <span className="spread-orbit" />
              {cards.map((drawn, index) => (
                <div
                  className={`spread-fan-card card-${index}`}
                  key={drawn.position}
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div
                    className="spread-fan-float"
                    style={{ animationDelay: `${index * 0.8}s` }}
                  >
                    <span className="spread-fan-deal">
                      <TarotCard
                        card={drawn.card}
                        orientation={drawn.orientation}
                        faceUp
                        size="sm"
                      />
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="spread-legend">
              {cards.map((drawn, index) => {
                const keywords =
                  drawn.orientation === 'upright'
                    ? drawn.card.upright.keywords
                    : drawn.card.reversed.keywords
                return (
                  <div className="spread-legend-item" key={drawn.position}>
                    <span className="legend-index">0{index + 1}</span>
                    <span className="legend-copy">
                      <span className="legend-top">
                        <span className="legend-position">
                          {POSITIONS[drawn.position].label}
                        </span>
                        <span className="legend-name">{drawn.card.name}</span>
                      </span>
                      <span className="legend-keywords">
                        {keywords.slice(0, 3).join(' · ')}
                      </span>
                    </span>
                    <span className={`legend-orientation ${drawn.orientation}`}>
                      {drawn.orientation === 'upright' ? '正位' : '逆位'}
                    </span>
                  </div>
                )
              })}
            </div>
            {snapshot && (
              <figure className="summary-snapshot">
                <img src={snapshot} alt="当时的心情快照" />
                <figcaption>心情快照</figcaption>
              </figure>
            )}
          </aside>

          <div className="chat-panel ornate-corners">
            <span className="chat-atmosphere" aria-hidden="true">
              <span className="chat-ward">镜</span>
              <span className="chat-orbit" />
              <span className="chat-orbit chat-orbit-b" />
            </span>
            <div className="chat-head">
              <div className="chat-identity">
                <span className="chat-seal" aria-hidden="true">
                  <SealMark />
                </span>
                <div className="chat-headings">
                  <span className="chat-title">
                    月鉴
                    {offlineLabel && <em className="demo-tag">本心模式</em>}
                  </span>
                  <span className="chat-subtitle">
                    LUNAR MIRROR · 安静的回声
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={`chat-voice-toggle ${ttsOn ? 'is-on' : ''}`}
                aria-pressed={ttsOn}
                onClick={() => {
                  setTtsOn((value) => !value)
                  if (ttsOn) stopSpeaking()
                }}
              >
                <span className="chat-voice-dot" />
                {ttsOn ? '轻语 开' : '轻语 关'}
              </button>
            </div>

            {offlineLabel && (
              <div className="local-ribbon">
                <span className="local-ribbon-mark">✦</span>
                {querent
                  ? `本心模式 · 三种声音为「${querent}」而开，没有唯一答案；你写下的每一句都会参与解读`
                  : '本心模式 · 牌面给出几种声音，没有唯一答案；你写下的每一句都会参与解读'}
              </div>
            )}

            {crisisInChat && (
              <div className="chat-safety-banner" role="alert">
                <strong>{safetyContent?.title ?? '安全优先'}</strong>
                <span className="chat-safety-copy">
                  {safetyContent?.lead ??
                    '接下来不做牌面解读。请优先保护自己和他人的安全，联系现实中的帮助。'}
                </span>
                <span className="chat-safety-calls">
                  <a href="tel:110">110 报警</a>
                  <a href="tel:120">120 急救</a>
                  <a href="tel:12356">12356 心理援助</a>
                </span>
                <button
                  type="button"
                  className="ghost-btn small chat-safety-home"
                  onClick={onHome}
                >
                  返回首页
                </button>
              </div>
            )}

            <div
              className="chat-scroll"
              ref={scrollRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              aria-label="月鉴的回应"
              onScroll={handleChatScroll}
            >
              {messages.length === 0 && busy && (
                <div className="chat-empty">
                  <p>正在铺开牌面，请稍候。</p>
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  key={`${message.at}-${index}`}
                  className={`bubble-row ${message.role === 'user' ? 'is-user' : 'is-mirror'}`}
                >
                  {message.role === 'assistant' && (
                    <span className="bubble-avatar" aria-hidden="true">
                      <SealMark />
                    </span>
                  )}
                  <div
                    className={`bubble ${message.role === 'user' ? 'bubble-user' : 'bubble-mirror'} ${
                      streaming &&
                      message.role === 'assistant' &&
                      index === messages.length - 1
                        ? 'is-streaming'
                        : ''
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <i className="bubble-veil" aria-hidden="true" />
                    )}
                    {message.content.split('\n').filter(Boolean).map((line, lineIndex) => (
                      <p key={lineIndex}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
              {busy && !generating && !streaming && (
                <div className="bubble-row is-mirror" aria-hidden="true">
                  <span className="bubble-avatar" aria-hidden="true">
                    <SealMark />
                  </span>
                  <div className="bubble bubble-mirror typing">
                    <i className="bubble-veil" aria-hidden="true" />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}
              {!busy &&
                !generating &&
                !isGriefReading &&
                messages.length > 1 &&
                messages[messages.length - 1]?.role === 'assistant' &&
                messages.some((message) => message.role === 'user') && (
                  <div className="reading-lenses" aria-label="换一种读法">
                    <span className="reading-lenses-label">换一种读法</span>
                    {READING_LENSES.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className="reading-lens-btn"
                        onClick={() => changeReading(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              {error && phase === 'chat' && (
                <div className="error-banner" role="alert">
                  <p>{error}</p>
                  <div className="error-actions">
                    <button type="button" className="ghost-btn small" onClick={retry}>
                      重试
                    </button>
                    {!offlineLabel && (
                      <button
                        type="button"
                        className="ghost-btn small"
                        onClick={fallbackOffline}
                      >
                        用本心模式继续
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {offlineLabel &&
              userTurns === 0 &&
              messages.some((message) => message.role === 'assistant') &&
              !busy && (
                <div className="reply-suggestions">
                  <span className="suggestion-hint">或者，从一句真实的话开始</span>
                  <div className="suggestion-row">
                    {suggestions.map((text) => (
                      <button
                        key={text}
                        type="button"
                        className="suggestion-chip"
                        onClick={() => sendText(text)}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            <div className="chat-input">
              <div className="chat-input-head">
                <span className="chat-input-label">回信</span>
                <span className="chat-input-hint">
                  ENTER 发送 · SHIFT + ENTER 换行
                </span>
              </div>
              <textarea
                rows={2}
                value={input}
                maxLength={400}
                aria-label="写下给月鉴的回信"
                placeholder="写下此刻想到的，不必组织得很完整…"
                enterKeyHint="send"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.shiftKey) return
                  if (
                    event.nativeEvent.isComposing ||
                    event.nativeEvent.keyCode === 229
                  ) {
                    return
                  }
                  event.preventDefault()
                  send()
                }}
                disabled={busy}
              />
              <div className="chat-input-actions">
                {showJump && (
                  <button
                    type="button"
                    className="ghost-btn small chat-jump-btn"
                    onClick={jumpToLatest}
                  >
                    ↓ 最新
                  </button>
                )}
                {busy && !generating && streaming && !offlineLabel ? (
                  <button
                    type="button"
                    className="ghost-btn small chat-stop-btn"
                    onClick={stopGenerating}
                  >
                    停止生成
                  </button>
                ) : (
                  <button
                    type="button"
                    className="send-btn"
                    onClick={send}
                    disabled={!input.trim() || busy}
                  >
                    发送
                  </button>
                )}
              </div>
            </div>

            {messages.some((message) => message.role === 'assistant') && (
              <button
                type="button"
                className="finish-btn"
                onClick={() => void finish()}
                disabled={busy}
              >
                <span aria-hidden="true">✦</span>
                收拢这次对话 · 生成自省记录
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="insight-stage">
          {insight && savedEntry && (
            <InsightCard
              insight={insight}
              question={question}
              querent={querent}
              cards={cards}
              createdAt={savedEntry.createdAt}
              snapshot={snapshot}
            />
          )}
          <div className="insight-actions">
            <button type="button" className="primary-btn" onClick={onJournal}>
              去时间线看看
            </button>
            <button type="button" className="ghost-btn" onClick={onHome}>
              回到首页
            </button>
          </div>
          <p className="insight-saved-note">这份记录已自动存入你的时间线，只保存在本机。</p>
        </div>
      )}

      {generating && (
        <div className="veil" role="status" aria-live="polite">
          <span className="veil-star">✦</span>
          <p>正在把这次对话收拢成一面镜子…</p>
        </div>
      )}
    </section>
  )
}
