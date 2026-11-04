'use client'

/**
 * LoungeAudio - Zero-dependency, lightweight 8-bit synthetic audio engine.
 * Generates cozy retro game sound effects on the fly via the native Web Audio API.
 * No external MP3/WAV assets needed.
 */

let audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return null
    if (!audioCtx) {
      audioCtx = new AudioCtx()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    return audioCtx
  } catch (e) {
    return null
  }
}

let soundEnabled = true
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('aguila_lounge_sound')
  if (saved !== null) {
    soundEnabled = saved === 'true'
  }
}

export function isLoungeSoundEnabled() {
  return soundEnabled
}

export function toggleLoungeSound() {
  soundEnabled = !soundEnabled
  if (typeof window !== 'undefined') {
    localStorage.setItem('aguila_lounge_sound', String(soundEnabled))
  }
  return soundEnabled
}

/** Soft retro footstep tap */
export function playFootstepSound() {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const filter = ctx.createBiquadFilter()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(140 + Math.random() * 30, now)
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.04)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(320, now)

    gain.gain.setValueAtTime(0.02, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.045)
  } catch (e) {
    // Audio context error ignored
  }
}

/** Crisp, pleasant interaction chime */
export function playInteractSound() {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const chord = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.035)

      gain.gain.setValueAtTime(0.04, now + idx * 0.035)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.035 + 0.16)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + idx * 0.035)
      osc.stop(now + idx * 0.035 + 0.18)
    })
  } catch (e) {
    // Audio context error ignored
  }
}

/** Warm bubbling coffee percolator & steam hiss */
export function playCoffeeBrewSound() {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime

    // 1. Water bubbling pops
    const pops = [300, 420, 360, 500, 440, 600]
    pops.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + i * 0.08)
      osc.frequency.exponentialRampToValueAtTime(freq + 150, now + i * 0.08 + 0.04)

      gain.gain.setValueAtTime(0.03, now + i * 0.08)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.06)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + i * 0.08)
      osc.stop(now + i * 0.08 + 0.07)
    })

    // 2. High steam hiss
    const bufferSize = ctx.sampleRate * 0.4
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.02
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(3200, now + 0.2)
    filter.Q.setValueAtTime(3, now + 0.2)

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.015, now + 0.2)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)

    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(ctx.destination)

    noise.start(now + 0.2)
    noise.stop(now + 0.6)
  } catch (e) {
    // Audio context error ignored
  }
}

/** Sweet pet purr and cheerful chirp */
export function playPetSound() {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    // Cheerful arpeggio: A4 -> C#5 -> E5 -> A5
    const notes = [440, 554.37, 659.25, 880]
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(f, now + i * 0.06)

      gain.gain.setValueAtTime(0.035, now + i * 0.06)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.12)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + i * 0.06)
      osc.stop(now + i * 0.06 + 0.13)
    })
  } catch (e) {
    // Audio context error ignored
  }
}

/** Cute snack munch / crunch sound */
export function playSnackSound() {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const crunches = [0, 0.07, 0.14]
    crunches.forEach(offset => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(260 + Math.random() * 80, now + offset)
      osc.frequency.exponentialRampToValueAtTime(90, now + offset + 0.04)

      gain.gain.setValueAtTime(0.025, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.045)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + offset)
      osc.stop(now + offset + 0.05)
    })
  } catch (e) {
    // Audio context error ignored
  }
}

/** Soft cushion sit sound */
export function playSitSound() {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const filter = ctx.createBiquadFilter()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(95, now)
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.1)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(240, now)

    gain.gain.setValueAtTime(0.03, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.11)
  } catch (e) {
    // Audio context error ignored
  }
}
