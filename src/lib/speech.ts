let currentUtterance: SpeechSynthesisUtterance | null = null

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
  /xiaoxiao|xiaoyi|yaoyao|huihui|xiaomeng|xiaohan|xiaomo|xiaoxuan|xiaoshuang|xiaorui|xiaoyan|xiaochen|tingting|ting-ting|yunxia|female|女/

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

export function speak(text: string, voiceURI?: string): void {
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

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
  currentUtterance = null
}

export function speakingNow(): boolean {
  return Boolean(currentUtterance) && window.speechSynthesis.speaking
}
