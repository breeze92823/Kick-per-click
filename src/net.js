// Colyseus link to Kick-per-click-backend (room "world"): loads/saves the persisted half of `stats`,
// relays this player's pose / avatar / ball / legend, exposes the other players and the leaderboards.
// Never throws and never blocks play: with no server (or an unreachable one) the game simply runs
// offline on the localStorage save.
import { Client } from '@colyseus/sdk'
import { DEV_MODE, GAME_SLUG, NET, SERVER_URL } from './config.js'
import { authState, getPfp, sdk, getEquippedAvatar, getProportions, getSkinTextureUrl, subscribeAuth } from './bloxity.js'
import { hydrateStats, onStats, savedSnapshot, setTutorialReady, stats } from './stats.js'
import { markLoaded } from './loading.js'

const AVATAR_MAX = 3000 // backend AVATAR_MAX_LEN

export const net = {
  room: null,
  connected: false,
  hydrated: false, // a progress/noProgress answer arrived: saving is allowed
  leaderboard: { rebirths: [], level: [], playtime: [] }, // rows { id, name, value, avatar? }
  get sessionId() {
    return this.room?.sessionId ?? null
  },
  get players() {
    return this.room?.state?.players ?? null
  },
}

const boardListeners = new Set()
export function onLeaderboard(fn) {
  boardListeners.add(fn)
  fn(net.leaderboard)
  return () => boardListeners.delete(fn)
}

// --- Identity ----------------------------------------------------------------
// Signed-in players use their Bloxity id; everyone else a per-browser guest id (never saved).
function guestId() {
  const make = () => `guest-${Math.random().toString(36).slice(2, 10)}`
  try {
    let id = localStorage.getItem('kpc-guest')
    if (!id) localStorage.setItem('kpc-guest', (id = make()))
    return id
  } catch {
    return make()
  }
}
const GUEST = guestId()

export const sendBest = (distance) => send('kickBest', { distance })

// Other players' longest kicks for the HUD zone bar: [{ id, name, pfp, metres }], best first.
export function remoteBests() {
  const out = []
  net.players?.forEach((p, id) => {
    if (id !== net.sessionId && p.bestDistance > 0) out.push({ id, name: p.username || 'Player', pfp: p.pfp || '', metres: p.bestDistance })
  })
  return out.sort((a, b) => b.metres - a.metres)
}

function identity() {
  const u = authState.user
  const id = u && (u._id || u.id || u.userId || u.uid)
  if (!id) return { userId: GUEST, username: authState.guest?.displayName || authState.guest?.username || 'Guest' }
  return { userId: String(id), username: String(u.displayName || u.username || u.name || 'Player') }
}

// Bloxity avatar as the server relays it: JSON { equipped, proportions, skin }, length-capped.
// The skin URL is the first thing dropped when it does not fit.
function avatarJson() {
  if (!authState.user) return ''
  const equipped = getEquippedAvatar()
  if (!equipped) return ''
  for (const skin of [getSkinTextureUrl(), null]) {
    try {
      const json = JSON.stringify({ equipped, proportions: getProportions(), skin })
      if (json.length <= AVATAR_MAX) return json
    } catch {
      return ''
    }
  }
  return ''
}

// --- Saving ------------------------------------------------------------------
let lastSaved = ''
let saveTimer = 0
let firstDirty = 0
let sentId = '' // identity the server currently attributes saves to

const snapshot = () => JSON.stringify(savedSnapshot())
const isGuest = () => sentId.startsWith('guest-')

export function saveNow() {
  clearTimeout(saveTimer)
  saveTimer = 0
  firstDirty = 0
  if (!net.connected || !net.hydrated || isGuest()) return
  const snap = snapshot()
  if (snap === lastSaved) return
  lastSaved = snap
  send('saveProgress', JSON.parse(snap))
}

function scheduleSave() {
  if (!net.connected || !net.hydrated) return
  const now = performance.now()
  if (!firstDirty) firstDirty = now
  clearTimeout(saveTimer)
  const wait = Math.min(NET.saveDebounce * 1000, Math.max(0, firstDirty + NET.saveMaxWait * 1000 - now))
  saveTimer = setTimeout(saveNow, wait)
}

// --- Messages out ------------------------------------------------------------
function send(type, payload) {
  try {
    net.room?.send(type, payload)
  } catch (err) {
    console.warn('[net] send failed', type, err)
  }
}

let lastPose = ''
let lastPoseAt = 0
// Throttled to NET.poseHz; skips repeats while standing still.
export function sendPose(player, speed, pose = '') {
  if (!net.connected) return
  const now = performance.now()
  if (now - lastPoseAt < 1000 / NET.poseHz) return
  lastPoseAt = now
  const r = (n) => Math.round(n * 100) / 100
  const msg = { x: r(player.position.x), y: r(player.position.y), z: r(player.position.z), yaw: r(player.facing), speed01: r(Math.min(1, speed / player.moveSpeed)), grounded: player.grounded, pose }
  const key = JSON.stringify(msg)
  if (key === lastPose) return
  lastPose = key
  send('pose', msg)
}

let sentBall = null
let sentLegend = null
function syncEquipment() {
  if (!net.connected) return
  if (stats.equipped !== sentBall) send('setBall', { ball: (sentBall = stats.equipped) })
  if (stats.legend !== sentLegend) send('setLegend', { legend: (sentLegend = stats.legend) })
}

let sentAvatar = null
let sentPfp = null
export function syncAvatar() {
  if (!net.connected) return
  const pfp = getPfp()
  if (pfp !== sentPfp) send('setPfp', { pfp: (sentPfp = pfp) })
  const avatar = avatarJson()
  if (avatar === sentAvatar) return
  sentAvatar = avatar
  send('setAvatar', { avatar })
}

// --- Connection --------------------------------------------------------------
function attach(room) {
  net.room = room
  net.connected = true
  room.onMessage('progress', (doc) => {
    net.hydrated = true
    markLoaded('net')
    hydrateStats(doc ?? {})
    setTutorialReady()
    lastSaved = snapshot() // what the server holds: don't echo it straight back
  })
  room.onMessage('noProgress', () => {
    // New account, guest or no database: keep the local save and push it as the first save.
    net.hydrated = true
    markLoaded('net')
    lastSaved = ''
    setTutorialReady() // a new account (or guest): the tutorial starts from the local step
    saveNow()
  })
  room.onMessage('serverError', () => {
    // The save exists but could not be read: never overwrite it.
    net.hydrated = false
    markLoaded('net')
    console.warn('[net] server could not read the saved progress; saving is off for this session')
  })
  room.onMessage('leaderboard', (rows) => {
    net.leaderboard = { rebirths: rows?.rebirths ?? [], level: rows?.level ?? [], playtime: rows?.playtime ?? [] }
    for (const fn of boardListeners) fn(net.leaderboard)
  })
  room.onLeave(() => {
    if (net.room !== room) return
    net.room = null
    net.connected = false
    net.hydrated = false
    setTimeout(connect, 3000) // keep trying; local play is unaffected meanwhile
  })
  sentBall = sentLegend = sentAvatar = sentPfp = null
  syncEquipment()
  syncAvatar()
}

// Bloxity hosting has no fixed socket URL: the SDK resolves the endpoint of this game's server
// (a dev-channel page reaches the dev backend, prod the prod one) on every connect, and each
// resolve needs its own Client. A configured SERVER_URL (config.js, per channel) wins.
const canResolve = () => typeof sdk()?.net?.resolveEndpoint === 'function'
async function serverUrl() {
  if (SERVER_URL) return SERVER_URL
  const { endpoint } = await sdk().net.resolveEndpoint(GAME_SLUG)
  return endpoint
}

let connecting = false
async function connect() {
  if (!(SERVER_URL || canResolve()) || connecting || net.connected) return
  connecting = true
  try {
    const id = identity()
    sentId = id.userId
    const client = new Client(await serverUrl())
    attach(await client.joinOrCreate('world', { ...id, avatar: avatarJson(), pfp: getPfp() }))
  } catch (err) {
    if (!DEV_MODE) console.warn('[net] could not reach the server; playing offline', err?.message ?? err)
    markLoaded('net') // gave up for now: play offline rather than hold the loading screen
    setTutorialReady()
    setTimeout(connect, 10000)
  } finally {
    connecting = false
  }
}

export function initNet() {
  if (!SERVER_URL && !canResolve()) {
    markLoaded('net')
    setTutorialReady()
    return console.info('[net] no server configured; playing offline')
  }
  onStats(() => {
    scheduleSave()
    syncEquipment()
  })
  setInterval(saveNow, 30000) // playtime ticks without a stats event
  // The first ready call connects; later ones are sign-in / sign-out.
  subscribeAuth((s) => {
    if (!s.ready) return
    if (!net.connected) return void connect()
    const id = identity()
    if (id.userId === sentId) return send('identify', { username: id.username })
    saveNow() // under the old id, before switching
    net.hydrated = false
    sentId = id.userId
    send('identify', id)
    syncAvatar()
  })
  window.addEventListener('beforeunload', saveNow)
  document.addEventListener('visibilitychange', () => document.hidden && saveNow())
}
