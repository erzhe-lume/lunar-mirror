import { getAudioContext } from './sound'

const BELL_NOTES = [293.66, 349.23, 440, 523.25, 587.33]

let masterGain: GainNode | null = null
let sources: AudioScheduledSourceNode[] = []
let bellTimer: number | null = null
let duckTimer: number | null = null
let running = false
let currentVolume = 0.4

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0.05, value))
}

function targetGain(volume: number): number {
  return clampVolume(volume) * 0.12
}

function scheduleBell(
  ctx: AudioContext,
  start: number,
  frequency: number,
): void {
  if (!masterGain) return
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.08, start + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 5.5)
  gain.connect(masterGain)

  const fundamental = ctx.createOscillator()
  fundamental.type = 'sine'
  fundamental.frequency.setValueAtTime(frequency, start)
  fundamental.connect(gain)

  const shimmer = ctx.createOscillator()
  shimmer.type = 'triangle'
  shimmer.frequency.setValueAtTime(frequency * 2.01, start)
  const shimmerGain = ctx.createGain()
  shimmerGain.gain.setValueAtTime(0.22, start)
  shimmerGain.gain.exponentialRampToValueAtTime(0.0001, start + 3.2)
  shimmer.connect(shimmerGain)
  shimmerGain.connect(gain)

  fundamental.start(start)
  fundamental.stop(start + 6)
  shimmer.start(start)
  shimmer.stop(start + 3.5)
}

function scheduleNextBell(): void {
  const ctx = getAudioContext()
  if (!ctx || !running) return
  if (ctx.state !== 'running') {
    bellTimer = window.setTimeout(scheduleNextBell, 2500)
    return
  }
  const note =
    BELL_NOTES[Math.floor(Math.random() * BELL_NOTES.length)] ?? BELL_NOTES[0]
  scheduleBell(ctx, ctx.currentTime + 0.1, note)
  bellTimer = window.setTimeout(scheduleNextBell, 18000 + Math.random() * 14000)
}

export function startBgm(volume = 0.4): void {
  const ctx = getAudioContext()
  if (!ctx) return
  currentVolume = clampVolume(volume)
  if (running) {
    setBgmVolume(volume)
    return
  }

  try {
    masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.0001, ctx.currentTime)
    masterGain.connect(ctx.destination)

    const droneFilter = ctx.createBiquadFilter()
    droneFilter.type = 'lowpass'
    droneFilter.frequency.value = 420
    droneFilter.Q.value = 0.6
    droneFilter.connect(masterGain)

    ;[73.42, 110, 146.83].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator()
      oscillator.type = index === 2 ? 'triangle' : 'sine'
      oscillator.frequency.value = frequency
      oscillator.detune.value = (index - 1) * 4
      const gain = ctx.createGain()
      gain.gain.value = index === 0 ? 0.16 : index === 1 ? 0.08 : 0.04
      oscillator.connect(gain)
      gain.connect(droneFilter)
      oscillator.start()
      sources.push(oscillator)
    })

    const padFilter = ctx.createBiquadFilter()
    padFilter.type = 'lowpass'
    padFilter.frequency.value = 900
    padFilter.connect(masterGain)
    ;[220, 261.63, 329.63].forEach((frequency) => {
      const oscillator = ctx.createOscillator()
      oscillator.type = 'triangle'
      oscillator.frequency.value = frequency
      const gain = ctx.createGain()
      gain.gain.value = 0.018
      oscillator.connect(gain)
      gain.connect(padFilter)
      oscillator.start()
      sources.push(oscillator)
    })

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.03
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 260
    lfo.connect(lfoGain)
    lfoGain.connect(padFilter.frequency)
    lfo.start()
    sources.push(lfo)

    const noiseBuffer = ctx.createBuffer(
      1,
      Math.floor(ctx.sampleRate * 4),
      ctx.sampleRate,
    )
    const noiseData = noiseBuffer.getChannelData(0)
    for (let index = 0; index < noiseData.length; index += 1) {
      noiseData[index] = (Math.random() * 2 - 1) * 0.04
    }
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer
    noise.loop = true
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 1200
    noiseFilter.Q.value = 0.5
    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.02
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(masterGain)
    noise.start()
    sources.push(noise)

    masterGain.gain.exponentialRampToValueAtTime(
      targetGain(currentVolume),
      ctx.currentTime + 2.5,
    )
    running = true
    scheduleNextBell()

    duckTimer = window.setInterval(() => {
      if (!masterGain) return
      const speaking =
        'speechSynthesis' in window && window.speechSynthesis.speaking
      const target = targetGain(speaking ? currentVolume * 0.3 : currentVolume)
      masterGain.gain.setTargetAtTime(target, ctx.currentTime, 0.3)
    }, 600)
  } catch {
    stopBgm()
  }
}

export function setBgmVolume(volume: number): void {
  currentVolume = clampVolume(volume)
  const ctx = getAudioContext()
  if (!ctx || !masterGain) return
  const speaking =
    'speechSynthesis' in window && window.speechSynthesis.speaking
  const target = targetGain(speaking ? currentVolume * 0.3 : currentVolume)
  masterGain.gain.setTargetAtTime(target, ctx.currentTime, 0.3)
}

export function stopBgm(): void {
  running = false
  if (bellTimer) {
    window.clearTimeout(bellTimer)
    bellTimer = null
  }
  if (duckTimer) {
    window.clearInterval(duckTimer)
    duckTimer = null
  }
  const gain = masterGain
  masterGain = null
  const nodes = sources
  sources = []
  if (!gain) return

  const ctx = getAudioContext()
  if (ctx) {
    gain.gain.cancelScheduledValues(ctx.currentTime)
    gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25)
  }
  window.setTimeout(() => {
    nodes.forEach((node) => {
      try {
        node.stop()
      } catch {
        // 已停止的节点忽略
      }
      node.disconnect()
    })
    try {
      gain.disconnect()
    } catch {
      // 已断开的节点忽略
    }
  }, 1300)
}

export function isBgmRunning(): boolean {
  return running
}
