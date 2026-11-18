let audioContext: AudioContext | null = null

interface ToneOptions {
  frequency: number
  duration: number
  gain: number
  type?: OscillatorType
  delay?: number
  detune?: number
}

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!audioContext) {
      const Constructor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Constructor) return null
      audioContext = new Constructor()
    }
    if (audioContext.state === 'suspended') void audioContext.resume()
    return audioContext
  } catch {
    return null
  }
}

export function getAudioContext(): AudioContext | null {
  return getContext()
}

function playTone(options: ToneOptions): void {
  const ctx = getContext()
  if (!ctx) return
  try {
    const {
      frequency,
      duration,
      gain,
      type = 'sine',
      delay = 0,
      detune = 0,
    } = options
    const start = ctx.currentTime + delay
    const oscillator = ctx.createOscillator()
    const amplifier = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    oscillator.detune.setValueAtTime(detune, start)
    amplifier.gain.setValueAtTime(0.0001, start)
    amplifier.gain.exponentialRampToValueAtTime(gain, start + 0.02)
    amplifier.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(amplifier)
    amplifier.connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.05)
  } catch {
    // 音频设备不可用时静默降级
  }
}

export function playChime(step = 0): void {
  const notes = [523.25, 587.33, 659.25, 783.99, 880]
  const frequency = notes[step % notes.length] ?? notes[0]
  playTone({ frequency, duration: 1.1, gain: 0.055 })
  playTone({
    frequency: frequency * 2,
    duration: 0.7,
    gain: 0.015,
    delay: 0.02,
    detune: 5,
    type: 'triangle',
  })
}

export function playShuffle(): void {
  const ctx = getContext()
  if (!ctx) return
  try {
    const duration = 0.6
    const buffer = ctx.createBuffer(
      1,
      Math.floor(ctx.sampleRate * duration),
      ctx.sampleRate,
    )
    const data = buffer.getChannelData(0)
    data.forEach((_, index) => {
      const fade = 1 - index / data.length
      data[index] = (Math.random() * 2 - 1) * fade * 0.6
    })

    const source = ctx.createBufferSource()
    source.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 0.8
    filter.frequency.setValueAtTime(500, ctx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(
      1800,
      ctx.currentTime + duration * 0.8,
    )
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    source.start()
    source.stop(ctx.currentTime + duration + 0.02)
    playTone({ frequency: 196, duration: 0.5, gain: 0.018 })
  } catch {
    // 音频设备不可用时静默降级
  }
}

export function playReveal(): void {
  ;[392, 523.25, 659.25].forEach((frequency, index) => {
    playTone({
      frequency,
      duration: 1.4,
      gain: 0.045,
      delay: index * 0.09,
    })
  })
}

export function playInsight(): void {
  ;[659.25, 783.99, 987.77].forEach((frequency, index) => {
    playTone({
      frequency,
      duration: 1.8,
      gain: 0.04,
      delay: index * 0.08,
    })
    playTone({
      frequency: frequency * 2,
      duration: 1.2,
      gain: 0.012,
      delay: index * 0.08,
      detune: 4,
    })
  })
}
