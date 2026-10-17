// Player progression: kick power fills the level bar, the equipped football and
// the training field set kick power per click, wins unlock footballs and rebirths.
// Saved to localStorage (best effort: storage may be blocked).
import { BALLS, BEACH, DEV_MODE, ECONOMY, KICKBALL, LANE, LEGENDS, TUTORIAL } from './config.js'

const SAVE_KEY = 'kick-per-click:v3'
const OLD_KEY = 'kick-per-click:v2' // rebirths started at 1 there
const SAVED = ['level', 'kickPower', 'wins', 'rebirths', 'owned', 'equipped', 'playtime', 'legends', 'legend', 'invSlots', 'spins', 'freeOnline', 'lastSeen', 'bestDistance', 'tutorialStep']

export const stats = {
  spins: 1, // Lucky Wheel spins in stock
  freeOnline: 0, // s played towards the next free spin
  lastSeen: 0, // epoch ms of the last session activity (0 = never played)
  bestDistance: 0, // m, longest kick ever
  tutorialStep: 0, // onboarding progress, saved; TUTORIAL.steps = finished (tutorial.js)
  tutorialReady: false, // the save (local or server) has been read, so we know whether this is a new player
  level: 1,
  kickPower: 0,
  wins: 0,
  rebirths: 0, // completed rebirths; see rebirthMult
  owned: [0], // football indices unlocked
  equipped: 0,
  playtime: 0, // s
  legends: ['cancello'], // owned legend ids
  legend: '', // equipped legend ('' = none): its wins multiplier applies to kicks
  invSlots: ECONOMY.invSlots, // how many legends the inventory can hold
  kickPass: 1, // the "1X > 2X KICK" pass multiplier
  friendBoost: 0, // % bonus from friends in the server
  autoClick: false,
  autoKick: false,
  field: null, // the TRAINING_FIELDS entry the player stands on
}

// Copies matching-typed saved fields onto stats and repairs anything that no longer exists.
function applyData(data) {
  // A save from before the tutorial existed belongs to a returning player: nothing left to teach.
  if (typeof data.tutorialStep !== 'number') data = { ...data, tutorialStep: TUTORIAL.steps }
  for (const k of SAVED) if (typeof data[k] === typeof stats[k]) stats[k] = data[k]
  stats.legends = stats.legends.filter((id) => LEGENDS.some((l) => l.id === id))
  if (!stats.legends.includes(stats.legend)) stats.legend = ''
  stats.invSlots = Math.max(stats.invSlots, stats.legends.length)
  if (!BALLS[stats.equipped] || !stats.owned.includes(stats.equipped)) stats.equipped = 0
  stats.freeOnline = Math.min(Math.max(0, stats.freeOnline), ECONOMY.freeSpinSeconds)
  grantOfflineSpins()
}

// Free spins announced by the HUD's FREE SPIN! toast (the HUD may not exist yet when one lands on load).
export const freeSpinNotice = { count: 0 }

// A player away for 24h+ comes back to a free spin per full day (up to offlineSpinMax).
function grantOfflineSpins() {
  const now = Date.now()
  const away = stats.lastSeen > 0 ? (now - stats.lastSeen) / 1000 : 0
  stats.lastSeen = now
  const n = Math.min(ECONOMY.offlineSpinMax, Math.floor(away / ECONOMY.offlineSpinSeconds))
  if (n < 1) return
  stats.spins += n
  freeSpinNotice.count += n
}

try {
  let data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')
  if (!data) {
    data = JSON.parse(localStorage.getItem(OLD_KEY) || 'null')
    if (data && typeof data.rebirths === 'number') data.rebirths = Math.max(0, data.rebirths - 1)
  }
  if (data) applyData(data)
} catch {
  // Fresh start.
}

// Dev/testing overrides (see .env.example): replace the saved value on every load when set.
for (const [key, raw] of [
  ['level', import.meta.env.VITE_START_LEVEL],
  ['rebirths', import.meta.env.VITE_START_REBIRTHS],
  ['wins', import.meta.env.VITE_START_WINS],
]) {
  const n = Number(raw)
  if (raw !== undefined && raw !== '' && Number.isFinite(n)) stats[key] = Math.max(key === 'level' ? 1 : 0, Math.floor(n))
}

// Called once the local save has been read (offline) or the server has answered (net.js).
export function setTutorialReady() {
  stats.tutorialReady = true
}

export function setTutorialStep(n) {
  stats.tutorialStep = n
  changed('tutorial')
}

let saveTimer = null
function save() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(savedSnapshot()))
    } catch {
      // Storage blocked: progress lasts this session only.
    }
  }, 1000)
}

const listeners = new Set()
export function onStats(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function changed(what) {
  save()
  for (const fn of listeners) fn(what)
}

// The persisted half of the stats (what the server saves, net.js).
export const savedSnapshot = () => Object.fromEntries(SAVED.map((k) => [k, stats[k]]))

// The server's saved doc replaces the local save (net.js `progress`).
export function hydrateStats(doc) {
  applyData(doc)
  changed('hydrate')
}

export const levelCap = (level = stats.level) => ECONOMY.capBase + ECONOMY.capPerLevel * level
// Applied to kick power and wins: driven by rebirths only (level does not affect it).
// Permanent rebirth multiplier: 1x at 0 rebirths, then 1.2x, 1.4x, ... (1 + multPerRebirth * rebirths)
export const rebirthMult = (r = stats.rebirths) => Math.round((1 + ECONOMY.multPerRebirth * r) * 100) / 100
export const multiplier = () => rebirthMult()
export const fieldUnlocked = (field) => stats.rebirths >= field.rebirths
// Beach World needs BEACH.rebirths; VITE_DEV_MODE=true lifts the requirement.
export const beachUnlocked = () => DEV_MODE || stats.rebirths >= BEACH.rebirths
// Kick power of a ball; the Black Hole ball is always 2x the best other ball you own.
export function ballKick(i) {
  const b = BALLS[i]
  if (!b.blackHole) return b.kick
  let best = 0
  for (const j of stats.owned) if (!BALLS[j]?.blackHole) best = Math.max(best, BALLS[j].kick)
  return Math.max(b.kick, best * 2)
}
export const perClick = () => ballKick(stats.equipped) * (stats.field?.mult ?? 1) * stats.kickPass

// Level needed to rebirth when r rebirths are done (0-based). Level is capped there until you rebirth.
export function rebirthLevel(r = stats.rebirths) {
  const t = ECONOMY.rebirthLevels
  const i = Math.max(0, r)
  return i < t.length ? t[i] : t[t.length - 1] + ECONOMY.rebirthLevelStep * (i - t.length + 1)
}
export const canRebirth = () => stats.level >= rebirthLevel()
export const rebirthProgress = () => Math.min(100, Math.floor((stats.level / rebirthLevel()) * 100))

// Full-power range (metres from the lane origin) of a ball with `kick` at Kick Power `level`.
// The reference state (ball +56, level 100) lands exactly on the lane end; any stronger product is capped.
export function rangeFor(kick, level) {
  const r = KICKBALL.range
  const f = Math.log10(1 + kick * level) / Math.log10(1 + r.refKick * r.refLevel)
  return Math.min(LANE.length, Math.max(r.minRange, LANE.length * Math.pow(f, r.curve)))
}
export const kickRange = () => rangeFor(ballKick(stats.equipped), stats.level)

// Wins for a kick that travelled `metres`: exponential in distance, scaled by the multiplier.
// `bonusPct` (Bonus Win ring) raises the base wins before the multipliers apply.
export function winsForDistance(metres, bonusPct = 0) {
  const { laneLength, winsMax, winsCurve: c } = ECONOMY
  const f = Math.min(1, Math.max(0, metres / laneLength))
  return Math.max(1, Math.round(((winsMax * (Math.exp(c * f) - 1)) / (Math.exp(c) - 1)) * (1 + bonusPct / 100) * multiplier() * legendMult()))
}

export const legendMult = () => LEGENDS.find((l) => l.id === stats.legend)?.mult ?? 1

// Buy a legend with wins, or equip an owned one. 'bought' | 'equipped' | 'already' | 'locked' | 'full'.
export function useLegend(id) {
  const l = LEGENDS.find((x) => x.id === id)
  if (!l) return 'locked'
  if (stats.legend === id) return 'already'
  let res = 'equipped'
  if (!stats.legends.includes(id)) {
    if (stats.legends.length >= stats.invSlots) return 'full'
    if (stats.wins < l.cost) return 'locked'
    stats.wins -= l.cost
    stats.legends.push(id)
    res = 'bought'
  }
  stats.legend = id
  changed('legends')
  return res
}

export function unequipLegend() {
  if (!stats.legend) return
  stats.legend = ''
  changed('legends')
}

export function equipBestLegend() {
  const best = stats.legends.map((id) => LEGENDS.find((l) => l.id === id)).sort((a, b) => b.mult - a.mult)[0]
  if (!best || best.id === stats.legend) return false
  stats.legend = best.id
  changed('legends')
  return true
}

// Removes legends from the inventory (their wins are not refunded). Returns how many went.
export function deleteLegends(ids) {
  const before = stats.legends.length
  stats.legends = stats.legends.filter((id) => !ids.includes(id))
  if (!stats.legends.includes(stats.legend)) stats.legend = ''
  if (stats.legends.length !== before) changed('legends')
  return before - stats.legends.length
}

export const invSlotCost = () => ECONOMY.invSlotCost * 2 ** (stats.invSlots - ECONOMY.invSlots)

// Buys one more inventory slot with wins. 'bought' | 'locked' | 'max'.
export function buyInvSlot() {
  if (stats.invSlots >= LEGENDS.length) return 'max'
  const cost = invSlotCost()
  if (stats.wins < cost) return 'locked'
  stats.wins -= cost
  stats.invSlots++
  changed('legends')
  return 'bought'
}

// A kick landed `metres` away: true when it beats the saved best.
export function recordDistance(metres) {
  const m = Math.floor(metres * 10) / 10
  if (!(m > stats.bestDistance)) return false
  stats.bestDistance = m
  changed('bestDistance')
  return true
}

export function addWins(n) {
  stats.wins += n
  changed('wins')
}

// --- Lucky Wheel -------------------------------------------------------------------------------
export const freeSpinLeft = () => Math.max(0, Math.ceil(ECONOMY.freeSpinSeconds - stats.freeOnline))

// Counts `dt` seconds of online play towards the free spin and hands it out when the timer fills.
function tickFreeSpin(dt) {
  stats.freeOnline += dt
  if (stats.freeOnline < ECONOMY.freeSpinSeconds) return
  stats.freeOnline -= ECONOMY.freeSpinSeconds
  stats.spins++
  freeSpinNotice.count++
  changed('freeSpin')
}

export function useSpin() {
  if (stats.spins < 1) return false
  stats.spins--
  changed('spins')
  return true
}

export function addSpins(n) {
  stats.spins += n
  changed('spins')
}

// Applies a wheel prize: { kind: 'wins' | 'kick' | 'kick2x' | 'spin' | 'legend', amount?, id? }.
export function grantPrize(p) {
  if (p.kind === 'wins') addWins(p.amount)
  else if (p.kind === 'kick') kick(1, p.amount)
  else if (p.kind === 'kick2x') kick(1, stats.kickPower)
  else if (p.kind === 'spin') addSpins(p.amount)
  else if (p.kind === 'legend' && !stats.legends.includes(p.id)) {
    stats.legends.push(p.id)
    stats.invSlots = Math.max(stats.invSlots, stats.legends.length) // a prize is never lost to a full inventory
    changed('legends')
  }
}

// One click: adds kick power and rolls any overflow into new levels (up to the rebirth level).
// `flat` replaces the per-click gain (wheel prizes).
export function kick(scale = 1, flat = null) {
  const gain = flat ?? perClick() * scale * multiplier()
  stats.kickPower += gain
  let leveled = false
  const maxLevel = rebirthLevel()
  while (stats.kickPower >= levelCap()) {
    if (stats.level >= maxLevel) {
      stats.kickPower = levelCap() // held full until you rebirth
      break
    }
    stats.kickPower -= levelCap()
    stats.level++
    leveled = true
  }
  changed(leveled ? 'level' : 'power')
  return { gain, leveled }
}

export function setField(field) {
  if (stats.field === field) return
  stats.field = field
  changed('field')
}

export function toggle(key) {
  stats[key] = !stats[key]
  changed(key)
  return stats[key]
}

// Equip an unlocked football, or unlock it once total wins reach its cost.
// Returns 'equipped' | 'unlocked' | 'already' | 'locked'.
export function useBall(i) {
  if (stats.equipped === i) return 'already'
  if (!stats.owned.includes(i)) {
    if (stats.wins < BALLS[i].cost) return 'locked'
    stats.wins -= BALLS[i].cost
    stats.owned.push(i)
    stats.equipped = i
    changed('balls')
    return 'unlocked'
  }
  stats.equipped = i
  changed('balls')
  return 'equipped'
}

// Needs the rebirth level. Resets level and kick power; wins, balls and fields are kept.
export function rebirth() {
  if (!canRebirth()) return false
  stats.rebirths++
  stats.level = 1
  stats.kickPower = 0
  changed('rebirth')
  return true
}

let playtimeSaved = 0
export function tickPlaytime(dt) {
  stats.playtime += dt
  playtimeSaved += dt
  stats.lastSeen = Date.now()
  tickFreeSpin(dt)
  if (playtimeSaved > 10) {
    playtimeSaved = 0
    save()
  }
}

// 950 -> "950", 1300 -> "1.3K", 2500000 -> "2.5M"
export function formatNumber(n) {
  const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi']
  let i = 0
  let v = Math.floor(n)
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000
    i++
  }
  return i === 0 ? String(v) : `${v >= 100 ? Math.floor(v) : Math.floor(v * 10) / 10}${units[i]}`
}
