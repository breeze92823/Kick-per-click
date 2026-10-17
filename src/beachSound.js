// Beach World ambience, synthesised with WebAudio (no audio files, so nothing to download): breaking waves that swell
// and hiss up the sand, foam fizz, water lapping, a light sea breeze and the odd seagull. Everything is noise through
// filters, and it all scales with how close the player is to the shoreline: faint wind and far-off surf anywhere on
// the beach, full surf at the water's edge, silence in the arena. Idle (no nodes touched) while in the arena.
import { BEACH, inBeach } from './config.js'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Looping pink-ish noise with decorrelated left/right channels (a wide, natural-sounding wash).
function noiseBuffer(ctx, seconds) {
  const n = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, n, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
  }
  return buf
}

export function createBeachSound() {
  let ctx = null
  let g = null // the graph's nodes, once built
  let level = 0 // 0 = arena, 1 = on the beach (eased)
  let gullTimer = 6

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
    const buf = noiseBuffer(ctx, 6)
    const layer = (type, freq, q, offset) => {
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = type
      filter.frequency.value = freq
      filter.Q.value = q
      const gain = ctx.createGain()
      gain.gain.value = 0
      src.connect(filter).connect(gain).connect(ctx.destination)
      src.start(0, offset)
      return { filter, gain }
    }
    g = {
      surf: layer('lowpass', 800, 0.5, 0), // the wave body
      fizz: layer('highpass', 2600, 0.4, 2.1), // foam hissing up the sand
      lap: layer('lowpass', 1300, 0.7, 4.3), // small ripples at the water's edge
      wind: layer('bandpass', 480, 0.6, 1.2), // sea breeze
    }
  }

  // Wave cycle: a quick build, a crash, then a long decaying hiss as the water runs back; irregular via a slow wobble.
  const wave = (t, period, phase) => {
    const p = (((t + phase) / period + 0.12 * Math.sin(t * 0.31 + phase)) % 1 + 1) % 1
    return p < 0.3 ? Math.pow(p / 0.3, 1.6) : Math.exp(-(p - 0.3) * 3.2)
  }

  function gull(volume) {
    const pan = ctx.createStereoPanner?.()
    if (pan) pan.pan.value = Math.random() * 1.6 - 0.8
    const out = pan ?? ctx.destination
    if (pan) pan.connect(ctx.destination)
    const syll = 2 + Math.floor(Math.random() * 3)
    const base = ctx.currentTime + 0.05
    const f0 = 1250 + Math.random() * 350
    for (let i = 0; i < syll; i++) {
      const t0 = base + i * (0.34 + Math.random() * 0.1)
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(f0 * 0.85, t0)
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.45, t0 + 0.11)
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.7, t0 + 0.4)
      const vib = ctx.createOscillator()
      vib.frequency.value = 28
      const vibDepth = ctx.createGain()
      vibDepth.gain.value = 55
      vib.connect(vibDepth).connect(osc.frequency)
      const band = ctx.createBiquadFilter()
      band.type = 'bandpass'
      band.frequency.value = 1900
      band.Q.value = 1.1
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, t0)
      env.gain.exponentialRampToValueAtTime(volume * (i === 0 ? 1 : 0.8), t0 + 0.03)
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42)
      osc.connect(band).connect(env).connect(out)
      osc.start(t0)
      vib.start(t0)
      osc.stop(t0 + 0.45)
      vib.stop(t0 + 0.45)
    }
    if (pan) setTimeout(() => pan.disconnect(), (syll * 0.5 + 1) * 1000)
  }

  const unlock = () => {
    try {
      if (!ctx) build()
      ctx.resume?.()
    } catch {}
  }
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { passive: true })

  return {
    // p: the player's position; t: elapsed seconds.
    update(dt, t, p) {
      level += ((inBeach(p.x) ? 1 : 0) - level) * Math.min(1, dt * 2)
      if (!ctx || !g || ctx.state !== 'running') return
      const now = ctx.currentTime
      const set = (param, v, tc = 0.2) => param.setTargetAtTime(v, now, tc)
      if (level < 0.005) {
        for (const l of Object.values(g)) set(l.gain.gain, 0, 0.1)
        return
      }
      // Proximity to the water: 1 at the shoreline (z = shoreZ), fading to 0 about 75 m inland.
      const near = clamp(1 - Math.max(0, p.z - BEACH.shoreZ) / 75, 0, 1)
      const prox = Math.pow(near, 1.4)
      const body = wave(t, 8.5, 0)
      const fizz = wave(t, 8.5, -0.9) // foam trails the crash
      const lapMod = 0.55 + 0.45 * Math.sin(t * 2.3) * Math.sin(t * 0.9 + 1)

      set(g.surf.gain.gain, level * (0.05 + 0.7 * prox) * (0.25 + 0.75 * body))
      set(g.surf.filter.frequency, 380 + 1900 * body * (0.35 + 0.65 * prox))
      set(g.fizz.gain.gain, level * prox * 0.42 * fizz)
      set(g.lap.gain.gain, level * Math.pow(prox, 2) * 0.22 * lapMod)
      set(g.wind.gain.gain, level * (0.035 + 0.045 * (1 - 0.4 * prox)) * (0.7 + 0.3 * Math.sin(t * 0.35)))
      set(g.wind.filter.frequency, 380 + 260 * (0.5 + 0.5 * Math.sin(t * 0.21)), 0.4)

      gullTimer -= dt
      if (gullTimer <= 0 && level > 0.8) {
        gull(0.03 + 0.07 * prox)
        gullTimer = 7 + Math.random() * 15
      }
    },
  }
}
