import type {
  ApiProtocol,
  ChatMessage,
  DrawnCard,
  Insight,
  JournalEntry,
  ModelProfile,
  Settings,
} from '../types'
import { DEFAULT_PROVIDER, defaultBaseFor } from './providers'
import { isThemeId } from './theme'

const DB_NAME = 'tarot-mirror'
const STORE = 'entries'
const SETTINGS_KEY = 'tarot-mirror.settings'
const NAV_KEY = 'tarot-mirror.nav'
const READING_KEY = 'tarot-mirror.reading'

export type PersistedView = 'home' | 'draw' | 'reading' | 'journal' | 'mirror'

export interface PersistedDraft {
  question: string
  snapshot?: string
  querent?: string
}

export interface PersistedSession extends PersistedDraft {
  cards: DrawnCard[]
}

export interface NavigationSnapshot {
  version: 1
  view: PersistedView
  draft: PersistedDraft | null
  session: PersistedSession | null
  readingSaved: boolean
}

export interface ReadingSnapshot {
  version: 1
  signature: string
  question: string
  cards: DrawnCard[]
  messages: ChatMessage[]
  input: string
  phase: 'chat' | 'insight'
  insight: Insight | null
  savedEntry: JournalEntry | null
}

function readingSignature(question: string, cards: DrawnCard[]): string {
  return [
    question,
    ...cards.map(
      (card) =>
        `${card.card.id}:${card.orientation}:${card.position}`,
    ),
  ].join('|')
}

export function loadNavigation(): NavigationSnapshot | null {
  try {
    const raw = localStorage.getItem(NAV_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<NavigationSnapshot>
    const views: PersistedView[] = ['home', 'draw', 'reading', 'journal', 'mirror']
    if (!parsed.version || !parsed.view || !views.includes(parsed.view)) {
      return null
    }
    if (parsed.view === 'reading' && !parsed.session) return null
    if (parsed.view === 'draw' && !parsed.draft) return null
    return {
      version: 1,
      view: parsed.view,
      draft: parsed.draft ?? null,
      session: parsed.session ?? null,
      readingSaved: Boolean(parsed.readingSaved),
    }
  } catch {
    return null
  }
}

export function saveNavigation(snapshot: NavigationSnapshot): void {
  try {
    localStorage.setItem(NAV_KEY, JSON.stringify(snapshot))
  } catch {
    // 浏览器存储已满时，刷新恢复会退化为普通本心页面。
  }
}

export function clearNavigation(): void {
  try {
    localStorage.removeItem(NAV_KEY)
  } catch {
    // ignore
  }
}

export function loadReadingSnapshot(
  question: string,
  cards: DrawnCard[],
): ReadingSnapshot | null {
  try {
    const raw = localStorage.getItem(READING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ReadingSnapshot>
    if (
      parsed.version !== 1 ||
      parsed.signature !== readingSignature(question, cards) ||
      !Array.isArray(parsed.messages)
    ) {
      return null
    }
    return {
      version: 1,
      signature: parsed.signature,
      question: parsed.question ?? question,
      cards: parsed.cards ?? cards,
      messages: parsed.messages,
      input: typeof parsed.input === 'string' ? parsed.input : '',
      phase: parsed.phase === 'insight' ? 'insight' : 'chat',
      insight: parsed.insight ?? null,
      savedEntry: parsed.savedEntry ?? null,
    }
  } catch {
    return null
  }
}

export function saveReadingSnapshot(
  snapshot: Omit<ReadingSnapshot, 'version' | 'signature'>,
): void {
  try {
    localStorage.setItem(
      READING_KEY,
      JSON.stringify({
        ...snapshot,
        version: 1,
        signature: readingSignature(snapshot.question, snapshot.cards),
      }),
    )
  } catch {
    // 存储空间不足时不阻塞当前对话。
  }
}

export function clearReadingSnapshot(): void {
  try {
    localStorage.removeItem(READING_KEY)
  } catch {
    // ignore
  }
}

function requestDb(version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request =
      version === undefined
        ? indexedDB.open(DB_NAME)
        : indexedDB.open(DB_NAME, version)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => {
      const db = request.result
      if (db.objectStoreNames.contains(STORE)) {
        resolve(db)
        return
      }
      // An interrupted delete or upgrade can leave an empty database at the
      // current version; bump it so the store is created again.
      const repairVersion = db.version + 1
      db.close()
      resolve(requestDb(repairVersion))
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(request.error ?? new Error('IndexedDB upgrade blocked'))
  })
}

let openQueue: Promise<unknown> = Promise.resolve()

function openDb(): Promise<IDBDatabase> {
  const opened = openQueue.then(() => requestDb())
  openQueue = opened.catch(() => undefined)
  return opened
}

export async function listEntries(): Promise<JournalEntry[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).getAll()
    request.onsuccess = () => {
      const entries = (request.result as JournalEntry[]).sort(
        (a, b) => b.createdAt - a.createdAt,
      )
      db.close()
      resolve(entries)
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

export async function saveEntry(entry: JournalEntry): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  apiProtocol: DEFAULT_PROVIDER.protocol,
  apiBase: DEFAULT_PROVIDER.base,
  model: DEFAULT_PROVIDER.models[0],
  modelHistory: {},
  modelProfiles: [],
  activeProfileId: null,
  voiceEnabled: true,
  voiceURI: '',
  soundEnabled: false,
  bgmEnabled: false,
  bgmVolume: 0.4,
  offline: false,
  theme: 'violet',
}

const API_PROTOCOLS: ApiProtocol[] = ['openai', 'anthropic', 'gemini']

function readProtocol(value: unknown): ApiProtocol {
  return API_PROTOCOLS.includes(value as ApiProtocol)
    ? (value as ApiProtocol)
    : DEFAULT_SETTINGS.apiProtocol
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    const apiProtocol = readProtocol(parsed.apiProtocol)
    const apiBase =
      typeof parsed.apiBase === 'string' && parsed.apiBase.trim()
        ? parsed.apiBase
        : parsed.apiProtocol
          ? defaultBaseFor(apiProtocol)
          : DEFAULT_SETTINGS.apiBase
    const modelHistory: Record<string, string[]> = {}
    if (
      parsed.modelHistory &&
      typeof parsed.modelHistory === 'object' &&
      !Array.isArray(parsed.modelHistory)
    ) {
      Object.entries(parsed.modelHistory).forEach(([key, value]) => {
        if (!Array.isArray(value)) return
        const models = Array.from(
          new Set(
            value
              .filter((item): item is string => typeof item === 'string')
              .map((item) => item.trim())
              .filter(Boolean),
          ),
        ).slice(0, 12)
        if (models.length > 0) modelHistory[key] = models
      })
    }

    const modelProfiles: ModelProfile[] = []
    if (Array.isArray(parsed.modelProfiles)) {
      parsed.modelProfiles.forEach((item) => {
        if (!item || typeof item !== 'object') return
        const profile = item as Partial<ModelProfile>
        const profileBase =
          typeof profile.apiBase === 'string' && profile.apiBase.trim()
            ? profile.apiBase
            : defaultBaseFor(readProtocol(profile.apiProtocol))
        if (
          typeof profile.id === 'string' &&
          typeof profile.model === 'string' &&
          profile.model.trim()
        ) {
          modelProfiles.push({
            id: profile.id,
            apiProtocol: readProtocol(profile.apiProtocol),
            apiBase: profileBase,
            model: profile.model.trim(),
            apiKey:
              typeof profile.apiKey === 'string' ? profile.apiKey : '',
          })
        }
      })
    }
    const activeProfileId =
      typeof parsed.activeProfileId === 'string' &&
      modelProfiles.some((profile) => profile.id === parsed.activeProfileId)
        ? parsed.activeProfileId
        : null

    const bgmVolume =
      typeof parsed.bgmVolume === 'number' &&
      Number.isFinite(parsed.bgmVolume)
        ? Math.min(1, Math.max(0.05, parsed.bgmVolume))
        : DEFAULT_SETTINGS.bgmVolume

    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      apiProtocol,
      apiBase,
      model:
        typeof parsed.model === 'string' && parsed.model.trim()
          ? parsed.model
          : DEFAULT_SETTINGS.model,
      modelHistory,
      modelProfiles,
      activeProfileId,
      voiceEnabled:
        typeof parsed.voiceEnabled === 'boolean'
          ? parsed.voiceEnabled
          : DEFAULT_SETTINGS.voiceEnabled,
      voiceURI:
        typeof parsed.voiceURI === 'string' ? parsed.voiceURI : '',
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean'
          ? parsed.soundEnabled
          : DEFAULT_SETTINGS.soundEnabled,
      bgmEnabled:
        typeof parsed.bgmEnabled === 'boolean'
          ? parsed.bgmEnabled
          : DEFAULT_SETTINGS.bgmEnabled,
      bgmVolume,
      offline:
        typeof parsed.offline === 'boolean'
          ? parsed.offline
          : DEFAULT_SETTINGS.offline,
      theme: isThemeId(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}
