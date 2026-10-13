// Synthesised lucky-wheel audio (no asset files): peg ticks that follow the wheel's real
// rotation curve (so they slow down with it), plus a win fanfare. Never throws.
let ctx = null
let master = null
let noiseBuf = null

function ac() {
  if (ctx) return ctx
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.7
    master.connect(ctx.destination)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  } catch {
    ctx = null
  }
  return ctx
}

// A plastic flapper hitting a peg: a short filtered noise click plus a tiny woody body tone.
function tick(c, when, vel) {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(0.5 * vel, when + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05)
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2200 + Math.random() * 500
  bp.Q.value = 1.6
  src.connect(bp).connect(g).connect(master)
  src.start(when, Math.random() * 0.03, 0.06)
  const o = c.createOscillator()
  const og = c.createGain()
  o.type = 'triangle'
  o.frequency.setValueAtTime(900 + Math.random() * 120, when)
  o.frequency.exponentialRampToValueAtTime(420, when + 0.04)
  og.gain.setValueAtTime(0.0001, when)
  og.gain.exponentialRampToValueAtTime(0.22 * vel, when + 0.002)
  og.gain.exponentialRampToValueAtTime(0.0001, when + 0.05)
  o.connect(og).connect(master)
  o.start(when)
  o.stop(when + 0.06)
}

// Solve the CSS cubic-bezier(x1,y1,x2,y2) into a (time -> progress) table.
function easeTable(x1, y1, x2, y2, n = 400) {
  const b = (s, a, c) => 3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * c + s * s * s
  const t = []
  const p = []
  for (let i = 0; i <= n; i++) {
    const s = i / n
    t.push(b(s, x1, x2))
    p.push(b(s, y1, y2))
  }
  return { t, p }
}

/**
 * Schedule peg ticks for a spin. `totalDeg` is the rotation about to be applied, `startDeg` the
 * current angle, `slice` the degrees between pegs, `seconds` the CSS transition length.
 */
export function wheelSpinSound(startDeg, totalDeg, slice, seconds, bezier = [0.12, 0.7, 0.1, 1]) {
  try {
    const c = ac()
    if (!c) return
    if (c.state === 'suspended') c.resume()
    const { t, p } = easeTable(...bezier)
    const now = c.currentTime + 0.02
    let nextPeg = Math.floor(startDeg / slice) + 1
    let last = -1
    for (let i = 1; i < t.length; i++) {
      const a0 = startDeg + p[i - 1] * totalDeg
      const a1 = startDeg + p[i] * totalDeg
      while (nextPeg * slice <= a1) {
        const f = (nextPeg * slice - a0) / Math.max(1e-6, a1 - a0)
        const time = (t[i - 1] + f * (t[i] - t[i - 1])) * seconds
        // Fast ticks are quieter/softer; the last slow clacks are the loudest.
        const speed = 1 / Math.max(0.012, time - last)
        const vel = Math.min(1, Math.max(0.35, 1.1 - speed / 70))
        tick(c, now + time, vel)
        last = time
        nextPeg++
      }
    }
  } catch {
    /* audio is optional */
  }
}

function bell(c, when, freq, dur, vol) {
  for (const [mult, amp] of [[1, 1], [2.01, 0.35], [3.98, 0.12]]) {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.value = freq * mult
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(vol * amp, when + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    o.connect(g).connect(master)
    o.start(when)
    o.stop(when + dur + 0.05)
  }
}

/** Bright rising arpeggio with a sparkle tail. */
export function wheelWinSound() {
  try {
    const c = ac()
    if (!c) return
    if (c.state === 'suspended') c.resume()
    const t0 = c.currentTime + 0.02
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5] // C5 E5 G5 C6 E6
    notes.forEach((f, i) => bell(c, t0 + i * 0.085, f, 0.9, 0.2))
    // Final shimmering chord.
    ;[1046.5, 1318.5, 1567.98].forEach((f) => bell(c, t0 + 0.45, f, 1.4, 0.12))
    // Sparkles.
    for (let i = 0; i < 8; i++) bell(c, t0 + 0.5 + i * 0.07 + Math.random() * 0.03, 2093 + Math.random() * 2200, 0.25, 0.04)
  } catch {
    /* audio is optional */
  }
}
