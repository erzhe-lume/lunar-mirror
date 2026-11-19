import { useEffect, useRef, useState } from 'react'
import type { ApiProtocol, ModelProfile, Settings, ThemeId } from '../types'
import {
  listModels,
  resolveEndpoint,
  testConnection,
} from '../lib/llm'
import {
  API_PROTOCOLS,
  PROTOCOL_LABEL,
  PROVIDERS,
  defaultBaseFor,
  defaultModelFor,
  findProvider,
  modelHistoryKey,
  modelsFor,
  normalizeBase,
  providerLabel,
} from '../lib/providers'
import { listChineseVoices, pickPreferredVoice, speak } from '../lib/speech'
import { playChime } from '../lib/sound'
import { THEMES } from '../lib/theme'

interface Props {
  open: boolean
  settings: Settings
  onClose: () => void
  onSave: (settings: Settings) => void
  onPersist: (settings: Settings) => void
  onThemePreview: (theme: ThemeId) => void
}

type SettingsTab = 'model' | 'appearance' | 'sound'

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'model', label: '模型与接口' },
  { id: 'appearance', label: '外观' },
  { id: 'sound', label: '声音与偏好' },
]

function rememberModelIn(
  history: Record<string, string[]>,
  protocol: ApiProtocol,
  base: string,
  value: string,
): Record<string, string[]> {
  const name = value.trim()
  if (!name) return history
  const key = modelHistoryKey(protocol, base)
  const previous = history[key] ?? []
  return {
    ...history,
    [key]: [name, ...previous.filter((item) => item !== name)].slice(0, 8),
  }
}

export default function SettingsModal({
  open,
  settings,
  onClose,
  onSave,
  onPersist,
  onThemePreview,
}: Props) {
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [apiProtocol, setApiProtocol] = useState<ApiProtocol>(
    settings.apiProtocol,
  )
  const [apiBase, setApiBase] = useState(settings.apiBase)
  const [model, setModel] = useState(settings.model)
  const [modelHistory, setModelHistory] = useState<Record<string, string[]>>(
    settings.modelHistory ?? {},
  )
  const [profiles, setProfiles] = useState<ModelProfile[]>(
    settings.modelProfiles ?? [],
  )
  const [activeProfileId, setActiveProfileId] = useState<string | null>(
    settings.activeProfileId ?? null,
  )
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [openProfileMenuId, setOpenProfileMenuId] = useState<string | null>(
    null,
  )
  const [gatewayModels, setGatewayModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [voiceEnabled, setVoiceEnabled] = useState(settings.voiceEnabled)
  const [voiceURI, setVoiceURI] = useState(settings.voiceURI)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled)
  const [bgmEnabled, setBgmEnabled] = useState(settings.bgmEnabled)
  const [bgmVolume, setBgmVolumeValue] = useState(settings.bgmVolume)
  const [offline, setOffline] = useState(settings.offline)
  const [theme, setTheme] = useState<ThemeId>(settings.theme)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<SettingsTab>('model')
  const [modelNotice, setModelNotice] = useState('')
  const modalRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const testSeqRef = useRef(0)
  const modelFetchSeqRef = useRef(0)
  const testResultRef = useRef<HTMLParagraphElement | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    setApiKey(settings.apiKey)
    setApiProtocol(settings.apiProtocol)
    setApiBase(settings.apiBase)
    setModel(settings.model)
    setModelHistory(
      rememberModelIn(
        settings.modelHistory ?? {},
        settings.apiProtocol,
        settings.apiBase,
        settings.model,
      ),
    )
    const savedProfiles = [...(settings.modelProfiles ?? [])]
    let nextActive =
      settings.activeProfileId &&
      savedProfiles.some(
        (profile) => profile.id === settings.activeProfileId,
      )
        ? settings.activeProfileId
        : null
    if (
      !nextActive &&
      !settings.offline &&
      settings.apiKey.trim() &&
      settings.model.trim()
    ) {
      const match = savedProfiles.find(
        (profile) =>
          profile.apiProtocol === settings.apiProtocol &&
          normalizeBase(profile.apiBase) === normalizeBase(settings.apiBase) &&
          profile.model === settings.model &&
          profile.apiKey === settings.apiKey,
      )
      if (match) nextActive = match.id
    }
    let nextProfiles = savedProfiles
    if (
      nextProfiles.length === 0 &&
      settings.apiKey.trim() &&
      settings.model.trim()
    ) {
      const currentProfile: ModelProfile = {
        id: crypto.randomUUID(),
        apiProtocol: settings.apiProtocol,
        apiBase: settings.apiBase,
        model: settings.model,
        apiKey: settings.apiKey,
      }
      nextProfiles = [currentProfile]
      nextActive = nextActive ?? currentProfile.id
    }
    setProfiles(nextProfiles)
    setActiveProfileId(nextActive)
    setEditingProfileId(nextActive ?? nextProfiles[0]?.id ?? null)
    setOpenProfileMenuId(null)
    setGatewayModels([])
    setLoadingModels(false)
    setModelsError('')
    modelFetchSeqRef.current += 1
    setVoiceEnabled(settings.voiceEnabled)
    setVoiceURI(settings.voiceURI)
    setSoundEnabled(settings.soundEnabled)
    setBgmEnabled(settings.bgmEnabled)
    setBgmVolumeValue(settings.bgmVolume)
    setOffline(settings.offline)
    setTheme(settings.theme)
    setShowKey(false)
    setActiveTab('model')
    setModelNotice('')
    testSeqRef.current += 1
    setTesting(false)
    setTestResult(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (panelRef.current) panelRef.current.scrollTop = 0
  }, [activeTab, open])

  useEffect(() => {
    if (!open || !('speechSynthesis' in window)) return
    const load = () => setVoices(listChineseVoices())
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () =>
      window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const focusables = () =>
      Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]',
        ) ?? [],
      )
    const focusTimer = window.setTimeout(() => focusables()[0]?.focus(), 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open || !testResult) return
    testResultRef.current?.scrollIntoView({ block: 'nearest' })
  }, [open, testResult])

  if (!open) return null

  const autoVoice = pickPreferredVoice()
  const activeProvider = findProvider(apiProtocol, apiBase)
  const activeProtocol = API_PROTOCOLS.find((item) => item.id === apiProtocol)
  const historyKey = modelHistoryKey(apiProtocol, apiBase)
  const savedModels = modelHistory[historyKey] ?? []
  const modelOptions = Array.from(
    new Set([...savedModels, ...gatewayModels, ...modelsFor(apiProtocol, apiBase)]),
  )
  const endpointPreview = resolveEndpoint({ apiProtocol, apiBase, model })
  const currentProvider = providerLabel(apiProtocol, apiBase)

  const draftSettings = (): Settings => ({
    apiKey: apiKey.trim(),
    apiProtocol,
    apiBase: apiBase.trim() || defaultBaseFor(apiProtocol),
    model: model.trim() || defaultModelFor(apiProtocol, apiBase),
    modelHistory,
    modelProfiles: profiles,
    activeProfileId,
    voiceEnabled,
    voiceURI,
    soundEnabled,
    bgmEnabled,
    bgmVolume,
    offline,
    theme,
  })

  const invalidateTest = () => {
    testSeqRef.current += 1
    modelFetchSeqRef.current += 1
    setTesting(false)
    setLoadingModels(false)
    setTestResult(null)
    setModelsError('')
    setModelNotice('')
  }

  const rememberModel = (
    value: string,
    protocol = apiProtocol,
    base = apiBase,
  ) => {
    setModelHistory((previous) =>
      rememberModelIn(previous, protocol, base, value),
    )
  }

  const chooseModel = (value: string) => {
    if (!value.trim()) return
    setModel(value)
    rememberModel(value)
    invalidateTest()
  }

  const currentProfileFields = () => ({
    apiProtocol,
    apiBase: apiBase.trim() || defaultBaseFor(apiProtocol),
    model: model.trim() || defaultModelFor(apiProtocol, apiBase),
    apiKey: apiKey.trim(),
  })

  const editProfile = (profile: ModelProfile) => {
    setApiProtocol(profile.apiProtocol)
    setApiBase(profile.apiBase)
    setModel(profile.model)
    setApiKey(profile.apiKey)
    setEditingProfileId(profile.id)
    setOpenProfileMenuId(null)
    setGatewayModels([])
    invalidateTest()
    window.setTimeout(
      () => document.getElementById('settings-api-key')?.focus(),
      40,
    )
  }

  const beginAddProfile = () => {
    setEditingProfileId(null)
    setOpenProfileMenuId(null)
    setModel('')
    setGatewayModels([])
    setOffline(false)
    invalidateTest()
    window.setTimeout(
      () => document.getElementById('settings-model')?.focus(),
      40,
    )
  }

  const toggleProfile = (profile: ModelProfile, enabled: boolean) => {
    setOpenProfileMenuId(null)
    if (!enabled) {
      if (activeProfileId === profile.id) {
        setActiveProfileId(null)
        setOffline(true)
        setModelNotice(`已停用「${profile.model}」。`)
        onPersist({
          ...draftSettings(),
          activeProfileId: null,
          offline: true,
        })
      }
      return
    }
    setApiProtocol(profile.apiProtocol)
    setApiBase(profile.apiBase)
    setModel(profile.model)
    setApiKey(profile.apiKey)
    setActiveProfileId(profile.id)
    setEditingProfileId(profile.id)
    setOffline(false)
    setGatewayModels([])
    invalidateTest()
    setModelNotice(`已启用「${profile.model}」。`)
    onPersist({
      ...draftSettings(),
      apiKey: profile.apiKey,
      apiProtocol: profile.apiProtocol,
      apiBase: profile.apiBase,
      model: profile.model,
      activeProfileId: profile.id,
      offline: false,
    })
  }

  const removeProfile = (profile: ModelProfile) => {
    if (!window.confirm(`删除模型配置「${profile.model}」？`)) return
    const nextProfiles = profiles.filter((item) => item.id !== profile.id)
    const wasActive = activeProfileId === profile.id
    const nextActive = wasActive ? null : activeProfileId
    const nextOffline = wasActive ? true : offline
    setProfiles(nextProfiles)
    setOpenProfileMenuId(null)
    setModelNotice(`已删除「${profile.model}」。`)
    if (wasActive) {
      setActiveProfileId(null)
      setOffline(true)
      setEditingProfileId(null)
      setApiKey('')
    } else if (editingProfileId === profile.id) {
      setEditingProfileId(null)
    }
    onPersist({
      ...draftSettings(),
      apiKey: wasActive ? '' : apiKey,
      modelProfiles: nextProfiles,
      activeProfileId: nextActive,
      offline: nextOffline,
    })
  }

  const saveAll = () => {
    const fields = currentProfileFields()
    let nextProfiles = [...profiles]
    let targetId = editingProfileId
    if (fields.apiKey && fields.model) {
      if (targetId && nextProfiles.some((item) => item.id === targetId)) {
        nextProfiles = nextProfiles.map((item) =>
          item.id === targetId ? { ...item, ...fields } : item,
        )
      } else {
        const match = nextProfiles.find(
          (item) =>
            item.apiProtocol === fields.apiProtocol &&
            normalizeBase(item.apiBase) === normalizeBase(fields.apiBase) &&
            item.model === fields.model &&
            item.apiKey === fields.apiKey,
        )
        if (match) {
          targetId = match.id
        } else {
          targetId = crypto.randomUUID()
          nextProfiles = [{ id: targetId, ...fields }, ...nextProfiles]
        }
      }
    } else {
      targetId = null
    }
    const nextActive =
      offline || !fields.apiKey ? null : targetId
    const nextHistory = fields.model
      ? rememberModelIn(
          modelHistory,
          fields.apiProtocol,
          fields.apiBase,
          fields.model,
        )
      : modelHistory
    onSave({
      ...draftSettings(),
      apiKey: fields.apiKey,
      apiProtocol: fields.apiProtocol,
      apiBase: fields.apiBase,
      model: fields.model,
      modelHistory: nextHistory,
      modelProfiles: nextProfiles,
      activeProfileId: nextActive,
      offline,
    })
  }

  const saveCurrentModel = (asNew = false) => {
    const fields = currentProfileFields()
    if (!fields.apiKey || !fields.model) {
      setModelNotice('请先填写 API Key 和模型。')
      return
    }
    let nextProfiles = [...profiles]
    let targetId = asNew ? null : editingProfileId
    if (targetId && nextProfiles.some((item) => item.id === targetId)) {
      nextProfiles = nextProfiles.map((item) =>
        item.id === targetId ? { ...item, ...fields } : item,
      )
    } else {
      const match = nextProfiles.find(
        (item) =>
          item.apiProtocol === fields.apiProtocol &&
          normalizeBase(item.apiBase) === normalizeBase(fields.apiBase) &&
          item.model === fields.model &&
          item.apiKey === fields.apiKey,
      )
      if (match) {
        targetId = match.id
      } else {
        targetId = crypto.randomUUID()
        nextProfiles = [{ id: targetId, ...fields }, ...nextProfiles]
      }
    }
    if (!targetId) return
    const nextHistory = rememberModelIn(
      modelHistory,
      fields.apiProtocol,
      fields.apiBase,
      fields.model,
    )
    setProfiles(nextProfiles)
    setActiveProfileId(targetId)
    setEditingProfileId(targetId)
    setOffline(false)
    setModelHistory(nextHistory)
    setModelNotice(
      asNew ? '已另存为新模型并启用。' : '模型已保存并启用。',
    )
    onPersist({
      ...draftSettings(),
      apiKey: fields.apiKey,
      apiProtocol: fields.apiProtocol,
      apiBase: fields.apiBase,
      model: fields.model,
      modelHistory: nextHistory,
      modelProfiles: nextProfiles,
      activeProfileId: targetId,
      offline: false,
    })
  }

  const saveGatewayModels = () => {
    const fields = currentProfileFields()
    if (!fields.apiKey) {
      setModelNotice('请先填写 API Key。')
      return
    }
    if (gatewayModels.length === 0) {
      setModelNotice('请先读取网关模型。')
      return
    }
    let nextProfiles = [...profiles]
    let nextHistory = modelHistory
    let added = 0
    gatewayModels.forEach((name) => {
      nextHistory = rememberModelIn(
        nextHistory,
        fields.apiProtocol,
        fields.apiBase,
        name,
      )
      const existing = nextProfiles.find(
        (item) =>
          item.apiProtocol === fields.apiProtocol &&
          normalizeBase(item.apiBase) === normalizeBase(fields.apiBase) &&
          item.model === name &&
          item.apiKey === fields.apiKey,
      )
      if (existing) return
      nextProfiles = [
        {
          id: crypto.randomUUID(),
          apiProtocol: fields.apiProtocol,
          apiBase: fields.apiBase,
          model: name,
          apiKey: fields.apiKey,
        },
        ...nextProfiles,
      ]
      added += 1
    })
    const currentMatch = nextProfiles.find(
      (item) =>
        item.apiProtocol === fields.apiProtocol &&
        normalizeBase(item.apiBase) === normalizeBase(fields.apiBase) &&
        item.model === fields.model &&
        item.apiKey === fields.apiKey,
    )
    const nextActive = currentMatch?.id ?? activeProfileId
    setProfiles(nextProfiles)
    setModelHistory(nextHistory)
    if (currentMatch) {
      setEditingProfileId(currentMatch.id)
      setActiveProfileId(currentMatch.id)
    }
    setModelNotice(
      added > 0
        ? `已保存 ${added} 个模型配置；同一网关可分别启用。`
        : '这些模型已经全部保存过了。',
    )
    onPersist({
      ...draftSettings(),
      modelHistory: nextHistory,
      modelProfiles: nextProfiles,
      activeProfileId: nextActive,
    })
  }

  const selectProtocol = (next: ApiProtocol) => {
    if (next === apiProtocol) return
    invalidateTest()
    setApiProtocol(next)
    const knownBases = new Set(
      PROVIDERS.map((provider) => normalizeBase(provider.base)),
    )
    const nextBase =
      !apiBase.trim() || knownBases.has(normalizeBase(apiBase))
        ? defaultBaseFor(next)
        : apiBase
    setApiBase(nextBase)
    setGatewayModels([])
    const remembered = modelHistory[modelHistoryKey(next, nextBase)]?.[0]
    setModel(remembered ?? defaultModelFor(next, nextBase))
  }

  const selectProvider = (provider: (typeof PROVIDERS)[number]) => {
    invalidateTest()
    setApiProtocol(provider.protocol)
    setApiBase(provider.base)
    setGatewayModels([])
    const remembered =
      modelHistory[modelHistoryKey(provider.protocol, provider.base)]?.[0]
    setModel(remembered ?? provider.models[0])
  }

  const loadGatewayModels = async () => {
    if (!apiKey.trim()) {
      setModelsError('请先填入 API Key。')
      return
    }
    const seq = modelFetchSeqRef.current + 1
    modelFetchSeqRef.current = seq
    setLoadingModels(true)
    setModelsError('')
    try {
      const models = await listModels(draftSettings())
      if (seq !== modelFetchSeqRef.current) return
      setGatewayModels(models)
    } catch (caught) {
      if (seq !== modelFetchSeqRef.current) return
      setGatewayModels([])
      setModelsError(
        caught instanceof Error ? caught.message : '读取模型列表失败。',
      )
    } finally {
      if (seq === modelFetchSeqRef.current) setLoadingModels(false)
    }
  }

  const runTest = async () => {
    if (!apiKey.trim()) {
      setTestResult({ ok: false, text: '请先填入 API Key。' })
      return
    }
    const seq = testSeqRef.current + 1
    testSeqRef.current = seq
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testConnection(draftSettings())
      if (seq !== testSeqRef.current) return
      setTestResult({
        ok: true,
        text: `连接正常 · ${result.latencyMs}ms · ${result.model}`,
      })
      setModelHistory((previous) =>
        rememberModelIn(previous, apiProtocol, apiBase, result.model),
      )
    } catch (error) {
      if (seq !== testSeqRef.current) return
      setTestResult({
        ok: false,
        text:
          error instanceof Error
            ? error.message
            : '连接失败，请检查地址、Key 与网络。',
      })
    } finally {
      if (seq === testSeqRef.current) setTesting(false)
    }
  }

  return (
    <div
      className="modal-veil"
      role="dialog"
      aria-modal="true"
      aria-label="设置"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeRef.current()
      }}
    >
      <div className="modal settings-modal" ref={modalRef}>
        <header className="modal-head">
          <div>
            <span className="eyebrow">连接与偏好</span>
            <h3>设置</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <nav className="settings-tabs" role="tablist" aria-label="设置分类">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`settings-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`settings-panel-${tab.id}`}
              className={`settings-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="settings-panels" ref={panelRef}>
          {activeTab === 'appearance' && (
            <div
              className="settings-tab-panel"
              role="tabpanel"
              id="settings-panel-appearance"
              aria-labelledby="settings-tab-appearance"
            >
        <div className="theme-manager">
          <div className="theme-manager-head">
            <div>
              <h4 className="theme-manager-title">外观主题</h4>
              <p className="theme-manager-hint">
                切换会立即预览；点击底部保存后，下次打开仍会保留。
              </p>
            </div>
          </div>
          <div className="theme-options" role="radiogroup" aria-label="外观主题">
            {THEMES.map((option) => (
              <button
                type="button"
                role="radio"
                aria-checked={theme === option.id}
                className={`theme-option ${theme === option.id ? 'is-active' : ''}`}
                key={option.id}
                onClick={() => {
                  setTheme(option.id)
                  onThemePreview(option.id)
                }}
                title={option.description}
              >
                <span
                  className={`theme-swatch theme-swatch-${option.id}`}
                  aria-hidden="true"
                />
                <span className="theme-option-copy">
                  <strong>{option.name}</strong>
                  <em>{option.tone}</em>
                </span>
              </button>
            ))}
          </div>
        </div>
            </div>
          )}
          {activeTab === 'model' && (
            <div
              className="settings-tab-panel"
              role="tabpanel"
              id="settings-panel-model"
              aria-labelledby="settings-tab-model"
            >
        <div className="model-manager">
          <div className="model-manager-head">
            <div>
              <h4 className="model-manager-title">模型</h4>
              <p className="model-manager-hint">
                使用自有 API Key 管理自定义模型；同一网关或 Key 下的多个模型可分别保存、分别启用。
              </p>
            </div>
            <button
              type="button"
              className="ghost-btn small model-add-btn"
              onClick={beginAddProfile}
            >
              + 添加模型
            </button>
          </div>

          {profiles.length > 0 ? (
            <div className="model-list">
              {profiles.map((profile) => {
                const active =
                  activeProfileId === profile.id && !offline
                return (
                  <div
                    className={`model-row ${active ? 'is-active' : ''}`}
                    key={profile.id}
                  >
                    <button
                      type="button"
                      className="model-row-main"
                      onClick={() => editProfile(profile)}
                      aria-label={`编辑模型 ${profile.model}`}
                    >
                      <span className="model-row-icon" aria-hidden="true">
                        ↯
                      </span>
                      <span className="model-row-copy">
                        <strong>{profile.model}</strong>
                        <small>
                          {PROTOCOL_LABEL[profile.apiProtocol]} ·{' '}
                          {profile.apiBase}
                        </small>
                        <em
                          className={profile.apiKey ? 'has-key' : 'no-key'}
                        >
                          {profile.apiKey
                            ? 'API Key 已保存'
                            : '未保存 API Key'}
                        </em>
                      </span>
                    </button>
                    <div className="model-row-side">
                      <div className="model-row-menu-wrap">
                        <button
                          type="button"
                          className="model-row-more"
                          aria-label={`更多操作：${profile.model}`}
                          aria-haspopup="menu"
                          aria-expanded={openProfileMenuId === profile.id}
                          onClick={(event) => {
                            event.stopPropagation()
                            setOpenProfileMenuId((previous) =>
                              previous === profile.id ? null : profile.id,
                            )
                          }}
                        >
                          ⋯
                        </button>
                        {openProfileMenuId === profile.id && (
                          <div className="model-row-menu" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => editProfile(profile)}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="is-danger"
                              onClick={() => removeProfile(profile)}
                            >
                              删除
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className={`switch ${active ? 'is-on' : ''}`}
                        role="switch"
                        aria-checked={active}
                        aria-label={
                          active
                            ? `停用模型 ${profile.model}`
                            : `启用模型 ${profile.model}`
                        }
                        disabled={!profile.apiKey}
                        onClick={() =>
                          toggleProfile(profile, !active)
                        }
                      >
                        <span className="switch-dot" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="model-manager-empty">
              还没有保存的模型。填写下方接口并保存后，会出现在这里。
            </p>
          )}

          <span className="model-manager-foot">
            开关会立即生效；填写接口后，可在表单底部保存为独立模型。
          </span>
        </div>

        <div className="settings-api">
          <div className="settings-api-head">
            <span className="settings-section-title">模型接口</span>
            <span className="settings-current">{currentProvider}</span>
          </div>

          <div className="field">
            {API_PROTOCOLS.length > 1 && (
              <>
                <span className="field-label">协议</span>
                <div className="protocol-row" role="group" aria-label="接口协议">
                  {API_PROTOCOLS.map((protocol) => (
                    <button
                      key={protocol.id}
                      type="button"
                      className={`protocol-pill ${apiProtocol === protocol.id ? 'is-active' : ''}`}
                      aria-pressed={apiProtocol === protocol.id}
                      onClick={() => selectProtocol(protocol.id)}
                    >
                      <strong>{protocol.label}</strong>
                      <span>{protocol.caption}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <span className="field-hint">{activeProtocol?.hint}</span>
          </div>

          <div className="field">
            <span className="field-label">服务商预设</span>
            <div className="provider-row">
              {PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  className={`provider-chip ${activeProvider?.id === provider.id ? 'is-active' : ''}`}
                  aria-pressed={activeProvider?.id === provider.id}
                  onClick={() => selectProvider(provider)}
                >
                  {provider.label}
                </button>
              ))}
            </div>
            <span className="field-hint">
              点选会填入 Base URL 和示例模型；其他 OpenAI 兼容网关可以直接修改地址与模型。
            </span>
          </div>

          <label className="field">
            <span className="field-label">API Key</span>
            <div className="secret-row">
              <input
                id="settings-api-key"
                name="api-key"
                aria-label="API Key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value)
                  invalidateTest()
                }}
                placeholder={activeProvider?.keyPlaceholder ?? '服务商或网关的 API Key'}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="ghost-btn small"
                onClick={() => setShowKey((value) => !value)}
              >
                {showKey ? '隐藏' : '显示'}
              </button>
            </div>
            <span className="field-hint">
              Key 只保存在本机浏览器，不会上传到月鉴的服务器。公开部署时不要把 Key 放进前端，应由服务端代理鉴权；留空或开启本心模式时不会调用外部模型。
            </span>
          </label>

          <label className="field">
            <span className="field-label">Base URL / 网关地址</span>
            <input
              id="settings-base-url"
              name="base-url"
              aria-label="Base URL 或网关地址"
              type="text"
              value={apiBase}
              onChange={(event) => {
                setApiBase(event.target.value)
                setGatewayModels([])
                invalidateTest()
              }}
              placeholder={defaultBaseFor(apiProtocol)}
              spellCheck={false}
            />
            <span className="endpoint-preview">POST {endpointPreview}</span>
            <span className="field-hint">
              可填服务商 base URL 或完整端点。OpenAI 兼容接口会自动补 /chat/completions；Base URL 保留 /v1 时也可以。
            </span>
          </label>

          <div className="field">
            <div className="field-head">
              <label className="field-label" htmlFor="settings-model">
                模型
              </label>
              <button
                type="button"
                className="ghost-btn small model-fetch-btn"
                onClick={() => void loadGatewayModels()}
                disabled={loadingModels}
              >
                {loadingModels
                  ? '读取中…'
                  : gatewayModels.length > 0
                    ? `重新读取 · ${gatewayModels.length}`
                    : '读取网关模型'}
              </button>
            </div>
            <input
              id="settings-model"
              name="model"
              aria-label="模型"
              type="text"
              value={model}
              onChange={(event) => {
                setModel(event.target.value)
                invalidateTest()
              }}
              onBlur={() => rememberModel(model)}
              placeholder={modelOptions[0] ?? defaultModelFor(apiProtocol, apiBase)}
              list="api-models"
              spellCheck={false}
            />
            <datalist id="api-models">
              {modelOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            {gatewayModels.length > 0 && (
              <select
                className="model-gateway-select"
                value=""
                aria-label="从网关模型列表中选择"
                onChange={(event) => chooseModel(event.target.value)}
              >
                <option value="">网关模型 · {gatewayModels.length} 个，选择切换</option>
                {gatewayModels.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}
            {savedModels.length > 0 && (
              <div className="model-history">
                <span className="model-history-label">最近使用</span>
                <div className="model-chip-row">
                  {savedModels.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`model-chip ${model.trim() === option ? 'is-active' : ''}`}
                      onClick={() => chooseModel(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {modelsError && (
              <span className="field-hint model-error">{modelsError}</span>
            )}
            <span className="field-hint">
              可直接填写，也可以从网关读取模型列表。切换服务商时会恢复该地址上次使用的模型。
            </span>
          </div>

          <div className="api-check">
            <div className="api-check-row">
              <button
                type="button"
                className="ghost-btn small"
                onClick={() => void runTest()}
                disabled={testing}
              >
                {testing ? '检测中…' : '检测模型连通性'}
              </button>
              <span className="api-check-hint">
                <span
                  className={`status-dot ${testing ? 'is-busy' : testResult ? (testResult.ok ? 'is-ok' : 'is-fail') : ''}`}
                />
                {testing
                  ? '正在用当前配置发送一条最小请求…'
                  : '检测地址、Key、模型与返回格式，不会保存配置。'}
              </span>
            </div>
            {testResult && (
              <p
                ref={testResultRef}
                className={`test-result ${testResult.ok ? 'ok' : 'fail'}`}
              >
                {testResult.text}
              </p>
            )}
          </div>

          <div className="model-save-row">
            <button
              type="button"
              className="primary-btn small"
              onClick={() => saveCurrentModel(false)}
            >
              保存并启用
            </button>
            <button
              type="button"
              className="ghost-btn small"
              onClick={() => saveCurrentModel(true)}
            >
              另存为新模型
            </button>
            {gatewayModels.length > 0 && (
              <button
                type="button"
                className="ghost-btn small"
                onClick={saveGatewayModels}
              >
                保存全部 {gatewayModels.length} 个
              </button>
            )}
            {modelNotice && (
              <span className="model-save-note" role="status">
                {modelNotice}
              </span>
            )}
          </div>
        </div>
            </div>
          )}
          {activeTab === 'sound' && (
            <div
              className="settings-tab-panel"
              role="tabpanel"
              id="settings-panel-sound"
              aria-labelledby="settings-tab-sound"
            >
        <label className="switch-row">
          <span>
            <span className="field-label">朗读月鉴的回应</span>
            <span className="field-hint">
              使用浏览器语音合成，可随时在对话中关闭；不消耗月鉴的模型接口额度。
            </span>
          </span>
          <button
            type="button"
            className={`switch ${voiceEnabled ? 'is-on' : ''}`}
            role="switch"
            aria-checked={voiceEnabled}
            onClick={() => setVoiceEnabled((value) => !value)}
          >
            <span className="switch-dot" />
          </button>
        </label>

        <label className="field">
          <span className="field-label">月鉴的声音</span>
          <div className="voice-row">
            <select
              value={voiceURI}
              onChange={(event) => setVoiceURI(event.target.value)}
              aria-label="选择月鉴的朗读音色"
            >
              <option value="">
                自动推荐
                {autoVoice
                  ? `（${autoVoice.name
                      .replace(/^Microsoft /, '')
                      .replace(/ - Chinese.*$/, '')}）`
                  : ''}
              </option>
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} · {voice.lang}
                  {voice.localService ? ' · 本地' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="ghost-btn small"
              onClick={() =>
                speak('我是月鉴。先不急着找答案，我们慢慢看。', voiceURI)
              }
            >
              试听
            </button>
          </div>
          <span className="field-hint">
            自动优先清亮女声（Natural / 晓晓 / 晓伊 / 瑶瑶），语速与音高也按轻甜、清楚的方向调过；在线音色需要网络，断网时会回退到系统语音。
          </span>
          {voices.length > 0 &&
            !voices.some((voice) => /natural|neural/i.test(voice.name)) && (
              <span className="field-hint">
                当前系统只提供基础本地音色；使用 Edge 或安装 Natural 语音时，会自动优先更清亮自然的女声。
              </span>
            )}
        </label>

        <label className="switch-row">
          <span>
            <span className="field-label">始终使用本心模式</span>
            <span className="field-hint">
              没有 API Key 时会自动使用本心模式；打开后，即使配置了模型也只用本地解读。
            </span>
          </span>
          <button
            type="button"
            className={`switch ${offline ? 'is-on' : ''}`}
            role="switch"
            aria-checked={offline}
            onClick={() => setOffline((value) => !value)}
          >
            <span className="switch-dot" />
          </button>
        </label>

        <label className="switch-row">
          <span>
            <span className="field-label">仪式音效</span>
            <span className="field-hint">
              洗牌、选牌与翻开牌面时的轻量合成声，全部在本地生成，默认关闭。
            </span>
          </span>
          <button
            type="button"
            className={`switch ${soundEnabled ? 'is-on' : ''}`}
            role="switch"
            aria-checked={soundEnabled}
            onClick={() => {
              const next = !soundEnabled
              setSoundEnabled(next)
              if (next) playChime(2)
            }}
          >
            <span className="switch-dot" />
          </button>
        </label>

        <label className="switch-row">
          <span>
            <span className="field-label">背景氛围 · 镜室</span>
            <span className="field-hint">
              低频 drone、慢 pad 与远处的铃声，本地无缝生成；保存后生效，朗读回应时会自动压低。
            </span>
          </span>
          <button
            type="button"
            className={`switch ${bgmEnabled ? 'is-on' : ''}`}
            role="switch"
            aria-checked={bgmEnabled}
            onClick={() => setBgmEnabled((value) => !value)}
          >
            <span className="switch-dot" />
          </button>
        </label>

        {bgmEnabled && (
          <label className="field">
            <span className="field-label">氛围音量</span>
            <input
              type="range"
              className="volume-range"
              min="0.05"
              max="1"
              step="0.05"
              value={bgmVolume}
              onChange={(event) =>
                setBgmVolumeValue(Number(event.target.value))
              }
              aria-label="背景氛围音量"
            />
            <span className="field-hint">
              建议保持较低音量，只作为房间里的空气，而不是主角。
            </span>
          </label>
        )}

            </div>
          )}
        </div>

        <div className="settings-footer">
          <span className="settings-footer-note">
            {activeTab === 'model'
              ? '模型可在「模型与接口」中单独保存；其他修改点这里统一保存。'
              : '外观主题会即时预览；修改后点这里统一保存。'}
          </span>
          <button type="button" className="ghost-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={saveAll}
          >
            保存全部设置
          </button>
        </div>
      </div>
    </div>
  )
}
