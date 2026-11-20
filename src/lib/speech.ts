let currentUtterance: SpeechSynthesisUtterance | null = null
let activeSource: AudioBufferSourceNode | null = null
let fallbackAudio: HTMLAudioElement | null = null
let activeController: AbortController | null = null
let audioContext: AudioContext | null = null
let speechJob = 0

export interface CloudSpeechConfig {
  apiBase: string
  apiKey: string
}

export interface CloudVoice {
  id: string
  label: string
  hint: string
}

export const CLOUD_VOICES: CloudVoice[] = [
  {
    id: 'shimmer',
    label: '轻甜女声 · Shimmer',
    hint: '柔和、轻甜，适合夜里慢慢听',
  },
  {
    id: 'nova',
    label: '清亮女声 · Nova',
    hint: '清晰、明亮，适合白天阅读',
  },
]

export function isCloudVoice(voiceURI: string): boolean {
  return voiceURI.startsWith('cloud:')
}

export function cloudVoiceId(voiceURI: string): string {
  return isCloudVoice(voiceURI) ? voiceURI.slice('cloud:'.length) : ''
}

export function listChineseVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return []
  return window.speechSynthesis
    .getVoices()
    .filter(
      (voice) =>
        voice.lang.toLowerCase().startsWith('zh') ||
        /[\u4e00-\u9fff]/.test(voice.name),
    )
}

const FEMALE_VOICE =
  /xiaoxiao|xiaoyi|yaoyao|huihui|xiaomeng|xiaohan|xiaomo|xiaoxuan|xiaoshuang|xiaorui|xiaoyan|xiaochen|tingting|ting-ting|meijia|mei-jia|sinji|sin-ji|yunxia|female|女|google 普通话|普通话/

const MALE_VOICE =
  /yunxi|yunjian|yunyang|yunjie|yunhao|yunfeng|yunye|yunze|kangkang|male|男/

function voiceScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase()
  const female = FEMALE_VOICE.test(name)
  const male = !female && MALE_VOICE.test(name)
  let score = 0
  if (female) score += 30
  if (male) score -= 22
  if (name.includes('natural') || name.includes('neural')) score += 14
  if (name.includes('xiaoxiao')) score += 10
  else if (name.includes('xiaoyi')) score += 9
  else if (name.includes('yaoyao')) score += 8
  else if (name.includes('huihui')) score += 6
  else if (name.includes('tingting') || name.includes('ting-ting')) score += 4
  else if (name.includes('meijia') || name.includes('mei-jia')) score += 3
  if (voice.lang.toLowerCase() === 'zh-cn') score += 3
  else if (voice.lang.toLowerCase().startsWith('zh')) score += 1
  if (voice.localService) score += 1
  return score
}

export function pickPreferredVoice(
  voiceURI?: string,
): SpeechSynthesisVoice | null {
  const voices = listChineseVoices()
  if (voiceURI) {
    const chosen = voices.find(
      (voice) => voice.voiceURI === voiceURI || voice.name === voiceURI,
    )
    if (chosen) return chosen
  }
  if (voices.length === 0) return null
  return [...voices].sort((a, b) => voiceScore(b) - voiceScore(a))[0]
}

function splitSentences(text: string): string[] {
  const parts = text.match(/[^。！？!?；;\n]+[。！？!?；;]?/g) ?? [text]
  const chunks: string[] = []
  parts.forEach((part) => {
    const clean = part.trim()
    if (!clean) return
    if (chunks.length > 0 && clean.length < 8) {
      chunks[chunks.length - 1] += clean
    } else {
      chunks.push(clean)
    }
  })
  return chunks.length > 0 ? chunks : [text]
}

function speakSystem(text: string, voiceURI?: string): void {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const clean = text.replace(/[*#>`]/g, '').replace(/\s+/g, ' ').trim()
  if (!clean) return
  const voice = pickPreferredVoice(voiceURI)
  const chunks = splitSentences(clean)
  chunks.forEach((chunk, index) => {
    const utterance = new SpeechSynthesisUtterance(chunk)
    utterance.lang = voice?.lang || 'zh-CN'
    utterance.rate = 0.93
    utterance.pitch = 1.06
    utterance.volume = 1
    if (voice) utterance.voice = voice
    if (index === chunks.length - 1) currentUtterance = utterance
    window.speechSynthesis.speak(utterance)
  })
}

export function unlockSpeechAudio(): void {
  if (typeof window === 'undefined') return
  try {
    if (!audioContext) {
      const Ctor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return
      audioContext = new Ctor()
    }
    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }
    const silent = audioContext.createBuffer(1, 1, 22050)
    const source = audioContext.createBufferSource()
    source.buffer = silent
    source.connect(audioContext.destination)
    source.start(0)
  } catch {
    // Audio is optional; system speech can still work.
  }
}

function resolveCloudEndpoint(apiBase: string): string {
  const cleaned = apiBase.trim().replace(/\/+$/, '')
  if (!cleaned) return ''
  const root = cleaned
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/completions$/i, '')
    .replace(/\/models$/i, '')
    .replace(/\/audio\/speech$/i, '')
  return `${root}/audio/speech`
}

function stopCloud(): void {
  speechJob += 1
  activeController?.abort()
  activeController = null
  if (activeSource) {
    try {
      activeSource.stop()
    } catch {
      // Already stopped.
    }
    activeSource = null
  }
  if (fallbackAudio) {
    fallbackAudio.pause()
    fallbackAudio.src = ''
    fallbackAudio = null
  }
}

async function speakCloud(
  text: string,
  voiceId: string,
  config: CloudSpeechConfig,
): Promise<void> {
  const clean = text.replace(/[*#>`]/g, '').replace(/\s+/g, ' ').trim()
  if (!clean) return
  const endpoint = resolveCloudEndpoint(config.apiBase)
  if (!endpoint || !config.apiKey.trim()) {
    speakSystem(clean)
    return
  }

  const job = ++speechJob
  const controller = new AbortController()
  activeController = controller
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: voiceId,
        input: clean.slice(0, 4000),
        response_format: 'mp3',
        speed: 0.96,
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`speech ${response.status}`)
    }
    const buffer = await response.arrayBuffer()
    if (job !== speechJob) return

    if (audioContext) {
      await audioContext.resume().catch(() => undefined)
      if (job !== speechJob) return
      const decoded = await audioContext.decodeAudioData(buffer.slice(0))
      if (job !== speechJob) return
      const source = audioContext.createBufferSource()
      source.buffer = decoded
      source.connect(audioContext.destination)
      activeSource = source
      source.onended = () => {
        if (activeSource === source) activeSource = null
      }
      source.start(0)
      return
    }

    const blob = new Blob([buffer], {
      type: response.headers.get('content-type') || 'audio/mpeg',
    })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    fallbackAudio = audio
    audio.onended = () => {
      URL.revokeObjectURL(url)
      if (fallbackAudio === audio) fallbackAudio = null
    }
    await audio.play()
  } catch {
    if (job !== speechJob) return
    activeController = null
    speakSystem(clean)
  }
}

export function speak(
  text: string,
  voiceURI?: string,
  cloud?: CloudSpeechConfig,
): void {
  stopSpeaking()
  if (!text.trim()) return
  if (isCloudVoice(voiceURI ?? '')) {
    if (!cloud?.apiKey.trim()) {
      speakSystem(text)
      return
    }
    void speakCloud(text, cloudVoiceId(voiceURI ?? ''), cloud)
    return
  }
  speakSystem(text, voiceURI)
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
  currentUtterance = null
  stopCloud()
}

export function speakingNow(): boolean {
  if (currentUtterance && window.speechSynthesis?.speaking) return true
  if (activeSource) return true
  if (fallbackAudio && !fallbackAudio.paused) return true
  return false
}
