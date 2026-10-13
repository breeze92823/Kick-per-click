// Full-screen loading overlay. Stays opaque until the scene has rendered AND Bloxity auth has
// settled AND the character has loaded AND the first server join has answered (or given up /
// isn't configured), then fades out. VITE_DEV_MODE=true skips it. Drop the game logo at
// public/ui/logo.png; the title text shows until it exists.
// Inside the Bloxity portal its own loading overlay covers the game instead: we skip ours, feed it
// step text via game.loadingStep() and end it (loadingEnd) once every step is done.
import { GAME_TITLE, DEV_MODE } from './config.js'
import * as bloxity from './bloxity.js'
import { subscribeAuth } from './bloxity.js'
import './loading.css'

const FADE_MS = 450
const GIVE_UP_MS = 20000 // never trap the player behind a stuck step
const LOGO_SRC = `${import.meta.env.BASE_URL}ui/logo.png`
const DRIFT = ['⚽', '🥅', '⚽', '⭐', '⚽', '🥅', '⚽', '⭐', '⚽', '🥅', '⚽', '⭐']

const STEPS = [
  ['scene', 'Building the pitch…'],
  ['auth', 'Signing in…'],
  ['avatar', 'Lacing up your boots…'],
  ['net', 'Joining the world…'],
]
const done = Object.fromEntries(STEPS.map(([k]) => [k, false]))

let root = null
let fill = null
let pctEl = null
let statusEl = null
let pct = 0
let finished = false
let portalMode = false

function target() {
  const n = STEPS.filter(([k]) => done[k]).length
  return n === STEPS.length ? 100 : Math.round((n / STEPS.length) * 90)
}

function paint() {
  fill.style.width = `${pct}%`
  pctEl.textContent = `${pct}%`
  const next = STEPS.find(([k]) => !done[k])
  statusEl.textContent = pct >= 100 ? 'Ready!' : next ? next[1] : 'Almost there…'
}

function tick() {
  const t = target()
  if (pct < t) pct = Math.min(t, pct + Math.max(1, Math.ceil((t - pct) / 8)))
  paint()
  if (pct >= 100) return finish()
  setTimeout(tick, 30)
}

function finish() {
  if (finished) return
  finished = true
  root.classList.add('is-done')
  setTimeout(() => root.remove(), FADE_MS)
}

function portalUpdate() {
  if (finished) return
  const next = STEPS.find(([k]) => !done[k])
  if (next) {
    try {
      bloxity.sdk()?.game?.loadingStep?.(next[1])
    } catch {
      // Non-fatal.
    }
    return
  }
  finished = true
  bloxity.notifyFirstFrame()
}

// Marks a step complete ('scene' | 'auth' | 'avatar' | 'net'); safe to call repeatedly.
export function markLoaded(step) {
  if (step in done && !done[step]) {
    done[step] = true
    if (portalMode) portalUpdate()
  }
}

export function createLoading() {
  if (DEV_MODE) return
  const giveUp = () => STEPS.forEach(([k]) => markLoaded(k))
  subscribeAuth((s) => {
    if (s.ready) markLoaded('auth')
  })
  setTimeout(giveUp, GIVE_UP_MS)

  if (bloxity.sdk()) {
    portalMode = true
    portalUpdate()
    return
  }

  root = document.createElement('div')
  root.className = 'loading'
  root.style.transitionDuration = `${FADE_MS}ms`
  root.innerHTML = `
    <div class="loading-drift" aria-hidden="true"></div>
    <img class="loading-logo" alt="" draggable="false" />
    <h1 hidden></h1>
    <p></p>
    <div class="loading-track"><div class="loading-fill"></div><span class="loading-pct"></span></div>`
  const drift = root.querySelector('.loading-drift')
  DRIFT.forEach((ch, i) => {
    const s = document.createElement('span')
    s.textContent = ch
    s.style.cssText = `left:${(i * 83 + 7) % 100}%;font-size:${28 + ((i * 17) % 28)}px;animation-delay:${-((i * 1.7) % 14)}s;animation-duration:${9 + ((i * 5) % 7)}s`
    drift.appendChild(s)
  })
  const logo = root.querySelector('.loading-logo')
  const title = root.querySelector('h1')
  title.textContent = GAME_TITLE
  logo.alt = GAME_TITLE
  logo.onerror = () => {
    logo.remove()
    title.hidden = false
  }
  logo.src = LOGO_SRC
  fill = root.querySelector('.loading-fill')
  pctEl = root.querySelector('.loading-pct')
  statusEl = root.querySelector('p')
  document.body.appendChild(root)
  tick()
}
