// Player progression: kick power fills the level bar, the equipped football and
// the training field set kick power per click, wins unlock footballs and rebirths.
// Saved to localStorage (best effort: storage may be blocked).
import { BALLS, ECONOMY, KICKBALL } from './config.js'

const SAVE_KEY = 'kick-per-click:v3'
const OLD_KEY = 'kick-per-click:v2' // rebirths started at 1 there
const SAVED = ['level', 'kickPower', 'wins', 'rebirths', 'owned', 'equipped', 'playtime']

export const stats = {
  level: 1,
  kickPower: 0,
  wins: 0,
  rebirths: 0, // completed rebirths; see rebirthMult
  owned: [0], // football indices unlocked
  equipped: 0,
  playtime: 0, // s
  kickPass: 1, // the "1X > 2X KICK" pass multiplier
  friendBoost: 0, // % bonus from friends in the server
  autoClick: false,
  autoKick: false,
  field: null, // the TRAINING_FIELDS entry the player stands on
}

try {
  let data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')
  if (!data) {
    data = JSON.parse(localStorage.getItem(OLD_KEY) || 'null')
    if (data && typeof data.rebirths === 'number') data.rebirths = Math.max(0, data.rebirths - 1)
  }
  if (data) for (const k of SAVED) if (typeof data[k] === typeof stats[k]) stats[k] = data[k]
  if (!BALLS[stats.equipped] || !stats.owned.includes(stats.equipped)) stats.equipped = 0
} catch {
  // Fresh start.
}

let saveTimer = null
function save() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(Object.fromEntries(SAVED.map((k) => [k, stats[k]]))))
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

export const levelCap = (level = stats.level) => ECONOMY.capBase + ECONOMY.capPerLevel * level
// Applied to kick power and wins: driven by rebirths only (level does not affect it).
// Permanent rebirth multiplier: 1x at 0 rebirths, then 2x, 3x, ... (rebirths + 1)
export const rebirthMult = (r = stats.rebirths) => Math.round((1 + ECONOMY.multPerRebirth * r) * 100) / 100
export const multiplier = () => rebirthMult()
export const fieldUnlocked = (field) => stats.rebirths >= field.rebirths
export const perClick = () => BALLS[stats.equipped].kick * (stats.field?.mult ?? 1) * stats.kickPass

// Level needed to rebirth when r rebirths are done (0-based). Level is capped there until you rebirth.
export function rebirthLevel(r = stats.rebirths) {
  const t = ECONOMY.rebirthLevels
  const i = Math.max(0, r)
  return i < t.length ? t[i] : t[t.length - 1] + ECONOMY.rebirthLevelStep * (i - t.length + 1)
}
export const canRebirth = () => stats.level >= rebirthLevel()
export const rebirthProgress = () => Math.min(100, Math.floor((stats.level / rebirthLevel()) * 100))

// Launch speed of the equipped ball: grows with ball kick x level and with rebirths.
export function kickSpeed() {
  const k = KICKBALL
  const v = k.baseSpeed + k.speedPerDecade * Math.log10(1 + BALLS[stats.equipped].kick * stats.level) + k.speedPerRebirth * stats.rebirths
  return Math.min(k.maxSpeed, v)
}

// Wins for a kick that travelled `metres`: exponential in distance, scaled by the multiplier.
export function winsForDistance(metres) {
  const { laneLength, winsMax, winsCurve: c } = ECONOMY
  const f = Math.min(1, Math.max(0, metres / laneLength))
  return Math.max(1, Math.round(((winsMax * (Math.exp(c * f) - 1)) / (Math.exp(c) - 1)) * multiplier()))
}

export function addWins(n) {
  stats.wins += n
  changed('wins')
}

// One click: adds kick power and rolls any overflow into new levels (up to the rebirth level).
export function kick(scale = 1) {
  const gain = perClick() * scale * multiplier()
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
  if (playtimeSaved > 10) {
    playtimeSaved = 0
    save()
  }
}

// 950 -> "950", 1300 -> "1.3K", 2500000 -> "2.5M"
export function formatNumber(n) {
  const units = ['', 'K', 'M', 'B', 'T']
  let i = 0
  let v = Math.floor(n)
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000
    i++
  }
  return i === 0 ? String(v) : `${v >= 100 ? Math.floor(v) : Math.floor(v * 10) / 10}${units[i]}`
}
