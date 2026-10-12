// The on-screen HUD: KICK button and auto toggles, boosts, menu tiles, rebirth
// and win counters, level / kick power bar, power packs and pass offers. Plain
// DOM over the canvas; it only reads and calls stats.js.
import './hud.css'
import { showMenu } from './bloxity.js'
import {
  canRebirth,
  formatNumber,
  kick,
  levelCap,
  multiplier,
  onStats,
  rebirth,
  rebirthLevel,
  rebirthMult,
  rebirthProgress,
  stats,
  toggle,
} from './stats.js'

const INK = '#1b1b28'
const ICON = {
  menu: `<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  gear: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.4" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  cursor: `<svg viewBox="0 0 64 64"><path d="M16 4 L16 50 L27 40 L35 58 L43 54 L35 37 L50 37 Z" fill="#fff" stroke="#111" stroke-width="4" stroke-linejoin="round"/></svg>`,
  shoe: `<svg viewBox="0 0 100 64"><path d="M6 40 C6 26 14 16 24 12 L36 8 C40 16 48 22 58 24 L80 29 C92 32 97 40 95 48 L6 48 Z" fill="#46a8ff" stroke="#10213f" stroke-width="4" stroke-linejoin="round"/><path d="M6 46 L95 46 L93 56 C70 60 30 60 10 57 Z" fill="#fff" stroke="#10213f" stroke-width="4" stroke-linejoin="round"/><path d="M30 16 L40 24 M26 22 L36 30 M22 28 L32 36" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M48 36 Q66 31 86 39" stroke="#c4e6ff" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
  gem: `<svg viewBox="0 0 64 64"><polygon points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5" fill="#4fdc36" stroke="#123f14" stroke-width="5" stroke-linejoin="round"/><polygon points="32,20 42,26 42,38 32,44 22,38 22,26" fill="#c4ff9a"/></svg>`,
  friend: `<svg viewBox="0 0 70 64"><rect x="8" y="4" width="30" height="26" rx="6" fill="#ffd21a" stroke="${INK}" stroke-width="4"/><circle cx="18" cy="16" r="2.5" fill="${INK}"/><circle cx="28" cy="16" r="2.5" fill="${INK}"/><rect x="6" y="32" width="34" height="28" rx="4" fill="#2f7ae0" stroke="${INK}" stroke-width="4"/><path d="M54 30 v22 M43 41 h22" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M54 30 v22 M43 41 h22" stroke="#3ad14a" stroke-width="7" stroke-linecap="round"/></svg>`,
  shop: `<svg viewBox="0 0 64 64"><path d="M10 28 L32 38 L54 28 L54 52 L32 62 L10 52Z" fill="#e8344a" stroke="#3a0d16" stroke-width="4" stroke-linejoin="round"/><path d="M10 28 L32 18 L54 28 L32 38Z" fill="#7a1424" stroke="#3a0d16" stroke-width="4" stroke-linejoin="round"/><path d="M10 28 L3 16 L25 6 L32 18Z" fill="#ff6a7e" stroke="#3a0d16" stroke-width="4" stroke-linejoin="round"/><path d="M54 28 L61 16 L39 6 L32 18Z" fill="#ff6a7e" stroke="#3a0d16" stroke-width="4" stroke-linejoin="round"/><path d="M32 38 V62" stroke="#3a0d16" stroke-width="4"/></svg>`,
  rebirth: `<svg viewBox="0 0 64 64"><g fill="none" stroke-linecap="round"><path d="M10 34 A22 22 0 0 1 44 13" stroke="${INK}" stroke-width="15"/><path d="M54 30 A22 22 0 0 1 20 51" stroke="${INK}" stroke-width="15"/><path d="M10 34 A22 22 0 0 1 44 13" stroke="#ff3b4e" stroke-width="9"/><path d="M54 30 A22 22 0 0 1 20 51" stroke="#3aa0ff" stroke-width="9"/></g><polygon points="38,2 60,14 40,26" fill="#ff3b4e" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><polygon points="26,62 4,50 24,38" fill="#3aa0ff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/></svg>`,
  backpack: `<svg viewBox="0 0 64 64"><path d="M24 14 V9 a8 8 0 0 1 16 0 V14" fill="none" stroke="#4a2408" stroke-width="5"/><rect x="11" y="14" width="42" height="46" rx="12" fill="#ff9a2a" stroke="#4a2408" stroke-width="4"/><path d="M11 30 H53" stroke="#4a2408" stroke-width="4"/><rect x="19" y="37" width="26" height="17" rx="5" fill="#e0701a" stroke="#4a2408" stroke-width="4"/><rect x="29" y="26" width="6" height="8" rx="2" fill="#ffd21a" stroke="#4a2408" stroke-width="3"/></svg>`,
  legend: `<svg viewBox="0 0 64 64"><rect x="12" y="40" width="40" height="22" rx="6" fill="#bfe6ff" stroke="#1b2a3a" stroke-width="4"/><path d="M22 42 V60 M32 42 V60 M42 42 V60" stroke="#4aa8f0" stroke-width="4"/><rect x="18" y="12" width="28" height="30" rx="9" fill="#f2c08a" stroke="#3a2412" stroke-width="4"/><path d="M15 23 C11 4 53 2 49 23 C45 14 21 14 15 23Z" fill="#6b3a1a" stroke="#3a2412" stroke-width="3" stroke-linejoin="round"/><circle cx="27" cy="27" r="2.6" fill="#222"/><circle cx="37" cy="27" r="2.6" fill="#222"/><path d="M26 34 Q32 39 38 34" stroke="#222" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`,
  trophy: `<svg viewBox="0 0 64 64"><path d="M18 14 H8 C8 27 14 31 21 31 M46 14 H56 C56 27 50 31 43 31" fill="none" stroke="#5a3a06" stroke-width="9" stroke-linecap="round"/><path d="M18 14 H8 C8 27 14 31 21 31 M46 14 H56 C56 27 50 31 43 31" fill="none" stroke="#ffc21a" stroke-width="4" stroke-linecap="round"/><path d="M16 6 H48 V24 A16 16 0 0 1 16 24Z" fill="#ffc21a" stroke="#5a3a06" stroke-width="4" stroke-linejoin="round"/><path d="M22 10 V22" stroke="#fff3a0" stroke-width="4" stroke-linecap="round"/><rect x="27" y="39" width="10" height="10" fill="#e8a010" stroke="#5a3a06" stroke-width="3.5"/><rect x="16" y="49" width="32" height="11" rx="3" fill="#ffc21a" stroke="#5a3a06" stroke-width="4"/></svg>`,
}

const t = (text, cls = '') => `<span class="t ${cls}">${text}</span>`

// Legends window: Robux price icon, blocky character busts, and the legend list.
const ROBUX = `<svg viewBox="0 0 64 64"><path d="M32 4 L58 18 V46 L32 60 L6 46 V18Z" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><circle cx="32" cy="32" r="9" fill="none" stroke="#fff" stroke-width="7"/></svg>`
const bust = (skin, hair, shirt, trim, extra = '') =>
  `<svg viewBox="0 0 100 100"><rect x="8" y="62" width="84" height="36" rx="8" fill="${shirt}" stroke="#141420" stroke-width="3"/><rect x="2" y="66" width="20" height="30" rx="5" fill="${trim}" stroke="#141420" stroke-width="3"/><rect x="78" y="66" width="20" height="30" rx="5" fill="${trim}" stroke="#141420" stroke-width="3"/><rect x="36" y="54" width="28" height="14" fill="${skin}"/><rect x="26" y="14" width="48" height="46" rx="14" fill="${skin}" stroke="#141420" stroke-width="3"/><path d="M23 34 C20 4 80 4 77 34 C72 22 62 20 50 22 C38 20 28 22 23 34Z" fill="${hair}" stroke="#141420" stroke-width="3" stroke-linejoin="round"/><circle cx="39" cy="40" r="3.2" fill="#141420"/><circle cx="61" cy="40" r="3.2" fill="#141420"/><path d="M40 50 Q50 57 60 50" stroke="#141420" stroke-width="3" fill="none" stroke-linecap="round"/>${extra}</svg>`
const CHILLI = `<svg viewBox="0 0 100 100"><path d="M46 14 C40 2 52 0 56 8 C62 4 68 10 58 16Z" fill="#2fb52a" stroke="#141420" stroke-width="3" stroke-linejoin="round"/><path d="M28 26 C28 16 72 16 72 26 L76 56 C76 70 66 82 50 84 C34 82 24 70 24 56Z" fill="#e5242b" stroke="#141420" stroke-width="3" stroke-linejoin="round"/><rect x="30" y="34" width="40" height="12" rx="5" fill="#141420"/><rect x="33" y="36" width="14" height="6" rx="2" fill="#7fc8ff"/><rect x="53" y="36" width="14" height="6" rx="2" fill="#7fc8ff"/><path d="M42 56 Q50 63 58 56" stroke="#141420" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="8" y="46" width="14" height="30" rx="5" fill="#e5242b" stroke="#141420" stroke-width="3"/><rect x="78" y="46" width="14" height="30" rx="5" fill="#e5242b" stroke="#141420" stroke-width="3"/><rect x="32" y="82" width="14" height="16" rx="3" fill="#3aa0ff" stroke="#141420" stroke-width="3"/><rect x="54" y="82" width="14" height="16" rx="3" fill="#3aa0ff" stroke="#141420" stroke-width="3"/></svg>`
const LEGENDS = [
  { name: 'Chillin Chilli', wins: '100x', price: 499, limited: true, left: '751 / 1000 left', icon: CHILLI },
  { tier: 'Divine', name: 'Ronaldu', wins: '50x', price: 279, icon: bust('#e8b48a', '#2a1a14', '#c8202c', '#0f6a46') },
  { tier: 'Common', name: 'Cancello', wins: '1x', owned: true, icon: bust('#f2c08a', '#241a16', '#4aa0f0', '#8fd0ff') },
  { tier: 'Rare', name: 'Pogbo', wins: '2x', price: 3, cost: '5.5K', icon: bust('#8a5a3a', '#1c1410', '#2a2018', '#d8a840') },
  { tier: 'Rare', name: 'Kvarra', wins: '3x', price: 9, cost: '18K', icon: bust('#f2c08a', '#8a4a28', '#f4f4f4', '#f4f4f4') },
  { tier: 'Epic', name: 'Neymer', wins: '5x', price: 19, cost: '95K', icon: bust('#f2c08a', '#3a2a22', '#f4f4f8', '#f4f4f8') },
  { tier: 'Legendary', name: 'Vinny Jr', wins: '8x', price: 49, cost: '2.25M', icon: bust('#7a4a2a', '#14100c', '#ffd81a', '#b8701a') },
  { tier: 'Legendary', name: 'Sallah', wins: '12x', price: 89, cost: '6.5M', icon: bust('#c08a5a', '#4a2a1c', '#d82030', '#f2c08a') },
  { tier: 'Divine', name: 'Yamol', wins: '20x', price: 179, cost: '20M', icon: bust('#c88a5a', '#3a2412', '#2a46b8', '#c42a50') },
  { tier: 'Divine', name: 'Beckhem', wins: '30x', price: 229, cost: '1B', icon: bust('#f2c08a', '#f0d890', '#d82a2a', '#f2c08a') },
  { tier: 'Divine', name: 'Kruyf', wins: '40x', price: 349, cost: '100B', icon: bust('#f2c08a', '#5a3a22', '#2a46b8', '#c42a50') },
  { tier: 'Divine', name: 'De Bruyn', wins: '60x', price: 449, cost: '20T', icon: bust('#f2c08a', '#d8a860', '#6ab4f0', '#6ab4f0') },
  { tier: 'Divine', name: 'Haalando', wins: '75x', price: 549, cost: '10Qa', icon: bust('#f2c08a', '#e0b070', '#6ab4f0', '#6ab4f0') },
]
const legendRow = (l) => `
  <div class="lgrow ${l.limited ? 'limited' : ''} ${(l.tier ?? '').toLowerCase()}">
    <div class="lgicon">${l.icon}${l.limited ? t('LIMITED', 'lgtag') : ''}</div>
    <div class="lginfo">
      <span class="t lgname">${l.tier ? `<span class="tier">${l.tier}</span> ` : ''}${l.name}</span>
      ${l.left ? t(l.left, 'lgleft') : ''}
      <div class="lgwins">${ICON.trophy}${t(`${l.wins} Wins`)}</div>
    </div>
    ${l.owned
      ? `<div class="lgbought studded">${t('Bought!')}</div>`
      : `<div class="lgbtns"><button class="lgbuy studded" data-act="buy">${ROBUX}${t(l.price)}</button>${l.cost ? `<button class="lgcost studded" data-act="buy">${ICON.trophy}${t(l.cost)}</button>` : ''}</div>`}
  </div>`

const TEMPLATE = `
  <div class="sysbar">
    <button class="sys" data-act="menu" aria-label="Menu">${ICON.menu}</button>
    <button class="sys" data-act="menu" aria-label="Settings">${ICON.gear}</button>
  </div>
  <div class="topbar">
    <button class="tool autoclick" data-act="autoClick">${ICON.cursor}<span class="dot"></span>${t('Auto Click')}</button>
    <button class="kick studded" data-act="kick">${t('KICK!')}</button>
    <button class="tool autokick" data-act="autoKick">${ICON.shoe}<span class="dot"></span>${t('Auto Kick')}</button>
  </div>
  <div class="boosts">
    <div class="boost">${ICON.shoe}${t('x1', 'kickx')}</div>
    <div class="boost">${ICON.friend}${t('+0%', 'friends')}</div>
  </div>
  <div class="menu">
    <button class="tile studded shop" data-act="shop">${ICON.shop}${t('Shop')}</button>
    <button class="tile studded rebirth" data-act="rebirth">${t('0%', 'pct')}${ICON.rebirth}${t('Rebirth')}</button>
    <button class="tile studded inventory" data-act="inventory">${ICON.backpack}${t('Inventory')}</button>
    <button class="tile studded legends" data-act="legends">${ICON.legend}${t('Legends')}</button>
  </div>
  <div class="counters">
    <div class="counter rebirths">${ICON.rebirth}${t('0', 'n')}</div>
    <div class="counter wins">${ICON.trophy}${t('0', 'n')}</div>
  </div>
  <div class="power">
    <div class="row">${t('Level 1', 'level')}${t('1x Multiplier', 'mult')}</div>
    <div class="bar studded"><div class="fill"></div>${t('Kick Power: 0/0', 'bartext')}</div>
    <div class="buys">
      <button class="buy studded b750" data-act="buy">${ICON.shoe}${t('+750 Power')}</button>
      <button class="buy studded b2k" data-act="buy">${ICON.shoe}${t('+2K Power')}</button>
      <button class="buy studded b4k" data-act="buy">${ICON.shoe}${t('+4K Power')}</button>
    </div>
  </div>
  <div class="offers">
    <button class="offer studded kick2x" data-act="buy"><span class="price">${ICON.gem}${t('3')}</span>${ICON.shoe}${t('1X &gt; 2X KICK')}${t('OP', 'op')}</button>
    <button class="offer studded wins2x" data-act="buy">${ICON.trophy}${t('2X WINS')}<span class="price">${ICON.gem}${t('89')}</span></button>
  </div>
  <div class="aim">
    <div class="meter studded"><div class="mfill"></div><i></i><i></i><i></i></div>
    ${t('Tap to Kick!', 'tap')}
  </div>
  <div class="prompt t"></div>
  <div class="toast t"></div>
  <div class="modal" data-act="closeRebirth">
    <div class="rbwin">
      <div class="rbhead studded-plate">
        ${ICON.rebirth}${t('Rebirth [1]', 'rbtitle')}
        <button class="rbclose studded" data-act="closeRebirth">${t('X')}</button>
      </div>
      <div class="rbbody">
        <div class="rbmults">
          <div class="chip studded">${ICON.shoe}${t('1x', 'from')}</div>
          <svg class="arrow" viewBox="0 0 64 56"><path d="M6 18 H34 V6 L60 28 L34 50 V38 H6Z" fill="#bfe6ff" stroke="#3a7bd8" stroke-width="4" stroke-linejoin="round"/></svg>
          <div class="chip studded">${ICON.shoe}${t('2x', 'to')}</div>
        </div>
        <div class="rbwarn t">REBIRTH RESETS YOUR LEVELS!</div>
        <div class="rbbar"><div class="rbfill"></div>${t('LEVEL: 1/20', 'rblevel')}</div>
        <button class="rbgo studded" data-act="doRebirth">${t('Rebirth')}</button>
      </div>
    </div>
  </div>
  <div class="modal lgmodal" data-act="closeLegends">
    <div class="lgwin">
      <div class="lghead studded-plate">
        ${bust('#f2c08a', '#5a3a22', '#bfe6ff', '#fff')}${t('Legends', 'lgtitle')}
        <button class="rbclose studded" data-act="closeLegends">${t('X')}</button>
      </div>
      <div class="lgbody">${LEGENDS.map(legendRow).join('')}</div>
    </div>
  </div>
`

export function createHud() {
  const root = document.createElement('div')
  root.id = 'hud'
  root.innerHTML = TEMPLATE
  document.body.appendChild(root)
  const $ = (sel) => root.querySelector(sel)
  const el = {
    level: $('.level'),
    mult: $('.mult'),
    fill: $('.bar .fill'),
    bar: $('.bartext'),
    rebirths: $('.counter.rebirths .n'),
    wins: $('.counter.wins .n'),
    pct: $('.pct'),
    kickx: $('.kickx'),
    friends: $('.friends'),
    autoClick: $('.autoclick'),
    autoKick: $('.autokick'),
    kickBtn: $('.kick'),
    kickLabel: $('.kick .t'),
    mfill: $('.mfill'),
    prompt: $('.prompt'),
    toast: $('.toast'),
    modal: $('.modal'),
    lgModal: $('.lgmodal'),
    rbTitle: $('.rbtitle'),
    rbFrom: $('.rbmults .from'),
    rbTo: $('.rbmults .to'),
    rbFill: $('.rbfill'),
    rbLevel: $('.rblevel'),
    rbGo: $('.rbgo'),
  }

  function renderRebirth() {
    const need = rebirthLevel()
    el.rbTitle.textContent = `Rebirth [${stats.rebirths}]`
    el.rbFrom.textContent = `${rebirthMult()}x`
    el.rbTo.textContent = `${rebirthMult(stats.rebirths + 1)}x`
    el.rbFill.style.width = `${Math.min(100, (stats.level / need) * 100)}%`
    el.rbLevel.textContent = `LEVEL: ${stats.level}/${need}`
    el.rbGo.classList.toggle('off', !canRebirth())
  }
  const setRebirthOpen = (on) => {
    if (on) renderRebirth()
    el.modal.classList.toggle('show', on)
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      setRebirthOpen(false)
      el.lgModal.classList.remove('show')
    }
  })

  function render() {
    const cap = levelCap()
    el.level.textContent = `Level ${formatNumber(stats.level)}`
    el.mult.textContent = `${Math.round(multiplier() * 100) / 100}x Multiplier`
    el.fill.style.width = `${Math.min(100, (stats.kickPower / cap) * 100)}%`
    el.bar.textContent = `Kick Power: ${formatNumber(stats.kickPower)}/${formatNumber(cap)}`
    el.rebirths.textContent = formatNumber(stats.rebirths)
    el.wins.textContent = formatNumber(stats.wins)
    el.pct.textContent = `${rebirthProgress()}%`
    el.kickx.textContent = `x${stats.kickPass * (stats.field?.mult ?? 1)}`
    el.friends.textContent = `+${stats.friendBoost}%`
    el.autoClick.classList.toggle('on', stats.autoClick)
    el.autoKick.classList.toggle('on', stats.autoKick)
  }

  let toastTimer = 0
  function toast(text) {
    el.toast.textContent = text
    el.toast.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1600)
  }

  let lastPrompt = null
  function setPrompt(text) {
    if (text === lastPrompt) return
    lastPrompt = text
    el.prompt.textContent = text ?? ''
    el.prompt.classList.toggle('show', !!text)
  }

  // One kick: stats, then a floating "+N" under the KICK button. `power` (0..1)
  // comes from the aim meter and scales both the stats gain and the ball's speed.
  let onKick = () => {}
  function kickNow(power = 1) {
    onKick(power)
    const { gain, leveled } = kick(0.5 + 0.5 * power)
    const r = el.kickBtn.getBoundingClientRect()
    const pop = document.createElement('span')
    pop.className = 't pop'
    pop.textContent = `+${formatNumber(gain)}`
    pop.style.left = `${r.left + r.width * (0.2 + Math.random() * 0.6)}px`
    pop.style.top = `${r.bottom + 6}px`
    root.appendChild(pop)
    pop.addEventListener('animationend', () => pop.remove())
    if (leveled) toast(`Level ${stats.level}!`)
  }

  // In the kick lane KICK! opens a power meter (KICK! becomes CANCEL); the next tap
  // (world click, F or the meter) kicks at the current level. Elsewhere it kicks at once.
  let inLane = false
  let aiming = false
  let aimStart = 0
  let aimRaf = 0
  let isBusy = () => false
  let onAim = () => {}
  const AIM_PERIOD = 1.1 // s for the meter to sweep up and back
  function aimLevel(now) {
    const ph = (((now - aimStart) / 1000 / AIM_PERIOD) % 1) * 2
    return ph < 1 ? ph : 2 - ph
  }
  function aimLoop(now) {
    el.mfill.style.height = `${aimLevel(now) * 100}%`
    aimRaf = requestAnimationFrame(aimLoop)
  }
  function setAiming(on) {
    if (on === aiming) return
    aiming = on
    root.classList.toggle('aiming', on)
    onAim(on)
    el.kickLabel.textContent = on ? 'CANCEL' : 'KICK!'
    cancelAnimationFrame(aimRaf)
    if (on) {
      aimStart = performance.now()
      aimRaf = requestAnimationFrame(aimLoop)
    }
  }
  function doKick() {
    if (!inLane) return kickNow()
    if (!aiming) {
      if (!isBusy()) setAiming(true)
      return
    }
    const power = aimLevel(performance.now())
    setAiming(false)
    kickNow(power)
  }
  function setLane(on) {
    if (on === inLane) return
    inLane = on
    root.classList.toggle('lane', on)
    if (!on) setAiming(false)
  }
  // Auto Click / Auto Kick skip the meter and kick at full power when the ball is free.
  function autoKick() {
    if (inLane && (aiming || isBusy())) return
    kickNow(1)
  }

  const actions = {
    menu: showMenu,
    kick: () => (aiming ? setAiming(false) : doKick()), // KICK! opens the meter, CANCEL closes it
    autoClick: () => toast(toggle('autoClick') ? 'Auto Click ON' : 'Auto Click OFF'),
    autoKick: () => toast(toggle('autoKick') ? 'Auto Kick ON' : 'Auto Kick OFF'),
    rebirth: () => setRebirthOpen(true),
    closeRebirth: () => setRebirthOpen(false),
    doRebirth: () => {
      if (!rebirth()) return toast(`Need Level ${rebirthLevel()} to rebirth`)
      setRebirthOpen(false)
      toast(`Rebirth ${stats.rebirths}!`)
    },
    shop: () => toast('Shop coming soon'),
    inventory: () => toast('Inventory coming soon'),
    legends: () => el.lgModal.classList.add('show'),
    closeLegends: () => el.lgModal.classList.remove('show'),
    buy: () => toast('Store coming soon'),
  }
  // No focus on mousedown: Space (jump) must never re-click a HUD button.
  root.addEventListener('mousedown', (e) => e.preventDefault())
  root.addEventListener('click', (e) => {
    if (aiming && e.target.closest('.aim')) return doKick()
    const btn = e.target.closest('[data-act]')
    if (!btn) return
    // The backdrop closes the window; clicks inside it (not on a button) must not.
    if (btn.classList.contains('modal') && e.target !== btn) return
    actions[btn.dataset.act]?.()
  })

  onStats(() => {
    render()
    if (el.modal.classList.contains('show')) renderRebirth()
  })
  render()
  return { doKick, autoKick, setBusyCheck: (fn) => (isBusy = fn), setOnAim: (fn) => (onAim = fn), setPrompt, setLane, toast, setOnKick: (fn) => (onKick = fn) }
}
