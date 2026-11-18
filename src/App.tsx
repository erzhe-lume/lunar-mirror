import { useEffect, useRef, useState } from 'react'
import type { DrawnCard, JournalEntry, Settings } from './types'
import { setBgmVolume, startBgm, stopBgm } from './lib/bgm'
import { detectSafetyConcern, type SafetyKind } from './lib/crisis'
import { applyTheme } from './lib/theme'
import {
  clearNavigation,
  clearReadingSnapshot,
  deleteEntry,
  listEntries,
  loadNavigation,
  loadSettings,
  saveEntry,
  saveNavigation,
  saveSettings,
} from './lib/storage'
import Background from './components/Background'
import Intro from './components/Intro'
import PosterFrame from './components/PosterFrame'
import SettingsModal from './components/SettingsModal'
import SafetyGate from './components/SafetyGate'
import SealMark from './components/SealMark'
import HomeView from './views/HomeView'
import DrawView from './views/DrawView'
import ReadingView from './views/ReadingView'
import JournalView from './views/JournalView'
import MirrorView from './views/MirrorView'
import './App.css'
import './visual-polish.css'
import './model-manager.css'
import './ring-timeline.css'
import './ring-ritual.css'
import './theme.css'

type View = 'home' | 'draw' | 'reading' | 'journal' | 'mirror'

const VIEWS: View[] = ['home', 'draw', 'reading', 'journal', 'mirror']

const hashFor = (view: View) => `#/${view}`

function viewFromHash(): View | null {
  const value = window.location.hash.replace(/^#\/?/, '')
  return VIEWS.includes(value as View) ? (value as View) : null
}

interface Draft {
  question: string
  snapshot?: string
  querent?: string
}

interface Session extends Draft {
  cards: DrawnCard[]
}

export default function App() {
  const [restored] = useState(() => loadNavigation())
  const [view, setView] = useState<View>(() => restored?.view ?? 'home')
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [draft, setDraft] = useState<Draft | null>(
    () => restored?.draft ?? null,
  )
  const [session, setSession] = useState<Session | null>(
    () => restored?.session ?? null,
  )
  const [readingSaved, setReadingSaved] = useState(
    () => restored?.readingSaved ?? false,
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [safetyGate, setSafetyGate] = useState<{
    querent?: string
    kind: SafetyKind
  } | null>(null)
  const [introOpen, setIntroOpen] = useState(
    () => !restored || restored.view === 'home',
  )
  const firstHistoryRef = useRef(true)
  const skipHistoryRef = useRef(false)
  const viewRef = useRef(view)
  const navStateRef = useRef({ session, draft })

  useEffect(() => {
    viewRef.current = view
  }, [view])

  useEffect(() => {
    navStateRef.current = { session, draft }
  }, [session, draft])

  useEffect(() => {
    const hash = hashFor(view)
    if (firstHistoryRef.current) {
      firstHistoryRef.current = false
      window.history.replaceState({ view }, '', hash)
      return
    }
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false
      return
    }
    if (window.history.state?.view === view && window.location.hash === hash) {
      return
    }
    window.history.pushState({ view }, '', hash)
  }, [view])

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const target =
        VIEWS.includes(event.state?.view as View)
          ? (event.state.view as View)
          : viewFromHash()
      if (!target) return
      let next = target
      if (next === 'reading' && !navStateRef.current.session) next = 'home'
      if (next === 'draw' && !navStateRef.current.draft) next = 'home'
      skipHistoryRef.current = true
      if (next !== target) {
        window.history.replaceState({ view: next }, '', hashFor(next))
      }
      if (next !== viewRef.current) {
        setView(next)
      } else {
        skipHistoryRef.current = false
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    void listEntries()
      .then(setEntries)
      .catch(() => setEntries([]))
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [view])

  useEffect(() => {
    if (view === 'home') {
      clearNavigation()
      return
    }
    saveNavigation({
      version: 1,
      view,
      draft,
      session,
      readingSaved,
    })
  }, [view, draft, session, readingSaved])

  useEffect(() => {
    if (!settings.bgmEnabled) {
      stopBgm()
      return
    }
    startBgm(settings.bgmVolume)
    const unlock = () => startBgm(settings.bgmVolume)
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      stopBgm()
    }
  }, [settings.bgmEnabled])

  useEffect(() => {
    setBgmVolume(settings.bgmVolume)
  }, [settings.bgmVolume])

  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  useEffect(() => {
    const titles: Record<View, string> = {
      home: '心镜 · 塔罗自省',
      draw: '抽牌 · 心镜',
      reading: '照见 · 心镜',
      journal: '时间线 · 心镜',
      mirror: '镜面 · 心镜',
    }
    document.title = titles[view]
  }, [view])

  const confirmLeaveReading = (): boolean => {
    if (view !== 'reading' || readingSaved) return true
    return window.confirm(
      '这次对话还没有生成自省记录。离开后仍可返回；如果开始新的抽牌，它将不会保存。确定离开吗？',
    )
  }

  const goHome = () => {
    if (!confirmLeaveReading()) return
    setView('home')
  }

  const openJournal = () => {
    if (!confirmLeaveReading()) return
    setView('journal')
  }

  const openMirror = () => {
    if (!confirmLeaveReading()) return
    setView('mirror')
  }

  const beginDraw = (question: string, snapshot?: string, querent?: string) => {
    const concern = detectSafetyConcern(question)
    if (concern) {
      setSafetyGate({ querent, kind: concern })
      return
    }
    clearReadingSnapshot()
    setSession(null)
    setReadingSaved(false)
    setDraft({ question, snapshot, querent })
    setView('draw')
  }

  const completeDraw = (cards: DrawnCard[]) => {
    if (!draft) {
      setView('home')
      return
    }
    setSession({ ...draft, cards })
    setReadingSaved(false)
    setView('reading')
  }

  const handleSaved = (entry: JournalEntry) => {
    setReadingSaved(true)
    setEntries((previous) => [entry, ...previous.filter((item) => item.id !== entry.id)])
    void saveEntry(entry).catch(() => {
      window.alert('记录保存失败，请检查浏览器的存储空间。')
    })
  }

  const handleUpdateEntry = async (entry: JournalEntry) => {
    await saveEntry(entry)
    setEntries((previous) =>
      previous.map((item) => (item.id === entry.id ? entry : item)),
    )
  }

  const handleDeleteEntry = async (id: string) => {
    await deleteEntry(id)
    setEntries((previous) => previous.filter((item) => item.id !== id))
  }

  const persistSettings = (next: Settings) => {
    setSettings(next)
    if (!saveSettings(next)) {
      window.alert('设置已应用，但浏览器存储写入失败；刷新后可能会丢失。')
    }
    applyTheme(next.theme)
  }

  const handleSaveSettings = (next: Settings) => {
    persistSettings(next)
    setSettingsOpen(false)
  }

  const closeSettings = () => {
    applyTheme(settings.theme)
    setSettingsOpen(false)
  }

  return (
    <div className={`app ${introOpen ? 'is-intro' : 'is-entered'}`}>
      <Background />
      {!introOpen && <PosterFrame />}
      <div className="app-inner">
        <header className="site-head">
          <button type="button" className="brand" onClick={goHome} aria-label="回到心镜首页">
            <span className="brand-mark" aria-hidden="true">
              <SealMark />
            </span>
            <span className="brand-text">
              <strong>心镜</strong>
              <em>MIRROR ARCANA</em>
            </span>
          </button>
          <nav className="site-nav" aria-label="主导航">
            <button
              type="button"
              className={`nav-btn ${view === 'mirror' ? 'is-active' : ''}`}
              onClick={openMirror}
            >
              镜面
            </button>
            <button
              type="button"
              className={`nav-btn ${view === 'journal' ? 'is-active' : ''}`}
              onClick={openJournal}
            >
              时间线
            </button>
            <button
              type="button"
              className="nav-btn"
              onClick={() => setSettingsOpen(true)}
            >
              设置
            </button>
          </nav>
        </header>

        <main className="view-shell" key={view}>
          {view === 'home' && (
            <HomeView
              settings={settings}
              latestEntry={entries[0]}
              onStart={beginDraw}
              onOpenJournal={openJournal}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}
          {view === 'draw' && draft && (
            <DrawView
              question={draft.question}
              querent={draft.querent}
              soundEnabled={settings.soundEnabled}
              onBack={goHome}
              onComplete={completeDraw}
            />
          )}
          {view === 'reading' && session && (
            <ReadingView
              settings={settings}
              question={session.question}
              querent={session.querent}
              snapshot={session.snapshot}
              cards={session.cards}
              onSaved={handleSaved}
              onHome={goHome}
              onJournal={openJournal}
            />
          )}
          {view === 'journal' && (
            <JournalView
              entries={entries}
              settings={settings}
              onBack={goHome}
              onUpdate={handleUpdateEntry}
              onDelete={handleDeleteEntry}
            />
          )}
          {view === 'mirror' && (
            <MirrorView
              entries={entries}
              onBack={goHome}
              onOpenJournal={openJournal}
            />
          )}
        </main>

        <footer className="site-foot">
          <span>心镜 · MIRROR ARCANA</span>
          <button
            type="button"
            className="foot-replay"
            onClick={() => setIntroOpen(true)}
          >
            重播开场
          </button>
          <span>塔罗不预言命运，只邀请你看见自己</span>
        </footer>
      </div>

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={closeSettings}
        onSave={handleSaveSettings}
        onPersist={persistSettings}
        onThemePreview={applyTheme}
      />
      {safetyGate && (
        <SafetyGate
          querent={safetyGate.querent}
          kind={safetyGate.kind}
          onClose={() => setSafetyGate(null)}
        />
      )}
      {introOpen && <Intro onDone={() => setIntroOpen(false)} />}
    </div>
  )
}
