// The on-screen HUD: KICK button and auto toggles, boosts, menu tiles, rebirth
// and win counters, level / kick power bar, power packs and pass offers. Plain
// DOM over the canvas; it only reads and calls stats.js.
import './hud.css'
import { showMenu } from './bloxity.js'
import { isTouch } from './device.js'
import { wheelSpinSound, wheelWinSound } from './wheelSound.js'
import { KICKBALL, LEGENDS, ZONES } from './config.js'
import { ECONOMY } from './config.js'
import {
  buyInvSlot,
  invSlotCost,
  canRebirth,
  deleteLegends,
  equipBestLegend,
  formatNumber,
  unequipLegend,
  freeSpinLeft,
  grantPrize,
  freeSpinNotice,
  useSpin,
  useLegend,
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
  rebirth: `<svg viewBox="0 0 64 64"><image href="${import.meta.env.BASE_URL}ui/rebirth.png" width="64" height="64"/></svg>`,
  backpack: `<svg viewBox="0 0 64 64"><path d="M24 14 V9 a8 8 0 0 1 16 0 V14" fill="none" stroke="#4a2408" stroke-width="5"/><rect x="11" y="14" width="42" height="46" rx="12" fill="#ff9a2a" stroke="#4a2408" stroke-width="4"/><path d="M11 30 H53" stroke="#4a2408" stroke-width="4"/><rect x="19" y="37" width="26" height="17" rx="5" fill="#e0701a" stroke="#4a2408" stroke-width="4"/><rect x="29" y="26" width="6" height="8" rx="2" fill="#ffd21a" stroke="#4a2408" stroke-width="3"/></svg>`,
  legend: `<svg viewBox="0 0 64 64"><rect x="12" y="40" width="40" height="22" rx="6" fill="#bfe6ff" stroke="#1b2a3a" stroke-width="4"/><path d="M22 42 V60 M32 42 V60 M42 42 V60" stroke="#4aa8f0" stroke-width="4"/><rect x="18" y="12" width="28" height="30" rx="9" fill="#f2c08a" stroke="#3a2412" stroke-width="4"/><path d="M15 23 C11 4 53 2 49 23 C45 14 21 14 15 23Z" fill="#6b3a1a" stroke="#3a2412" stroke-width="3" stroke-linejoin="round"/><circle cx="27" cy="27" r="2.6" fill="#222"/><circle cx="37" cy="27" r="2.6" fill="#222"/><path d="M26 34 Q32 39 38 34" stroke="#222" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`,
  box: `<svg viewBox="0 0 64 64"><path d="M6 18 L32 8 L58 18 L58 46 L32 58 L6 46Z" fill="#ff9a4a" stroke="#4a2408" stroke-width="4" stroke-linejoin="round"/><path d="M6 18 L32 28 L58 18 M32 28 V58" fill="none" stroke="#4a2408" stroke-width="4" stroke-linejoin="round"/><path d="M6 18 L32 28 V58 L6 46Z" fill="#ffb878"/><path d="M6 18 L32 28 V58 L6 46Z" fill="none" stroke="#4a2408" stroke-width="4" stroke-linejoin="round"/></svg>`,
  plus: `<svg viewBox="0 0 64 64"><path d="M32 10 V54 M10 32 H54" stroke="#0a3a0a" stroke-width="22" stroke-linecap="round"/><path d="M32 10 V54 M10 32 H54" stroke="#fff" stroke-width="12" stroke-linecap="round"/></svg>`,
  trash: `<svg viewBox="0 0 64 64"><path d="M14 18 H50 L46 58 H18Z" fill="#9fd8f0" stroke="#10213f" stroke-width="4" stroke-linejoin="round"/><path d="M10 18 H54" stroke="#10213f" stroke-width="5" stroke-linecap="round"/><path d="M24 18 V12 a3 3 0 0 1 3 -3 H37 a3 3 0 0 1 3 3 V18" fill="none" stroke="#10213f" stroke-width="4"/><path d="M25 26 L27 52 M32 26 V52 M39 26 L37 52" stroke="#5a9ac0" stroke-width="3.5" stroke-linecap="round"/></svg>`,
  check: `<svg viewBox="0 0 64 64"><path d="M8 34 L25 52 L58 12" fill="none" stroke="#0a3a0a" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 34 L25 52 L58 12" fill="none" stroke="#3fd23a" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  trophy: `<svg viewBox="0 0 64 64"><path d="M18 14 H8 C8 27 14 31 21 31 M46 14 H56 C56 27 50 31 43 31" fill="none" stroke="#5a3a06" stroke-width="9" stroke-linecap="round"/><path d="M18 14 H8 C8 27 14 31 21 31 M46 14 H56 C56 27 50 31 43 31" fill="none" stroke="#ffc21a" stroke-width="4" stroke-linecap="round"/><path d="M16 6 H48 V24 A16 16 0 0 1 16 24Z" fill="#ffc21a" stroke="#5a3a06" stroke-width="4" stroke-linejoin="round"/><path d="M22 10 V22" stroke="#fff3a0" stroke-width="4" stroke-linecap="round"/><rect x="27" y="39" width="10" height="10" fill="#e8a010" stroke="#5a3a06" stroke-width="3.5"/><rect x="16" y="49" width="32" height="11" rx="3" fill="#ffc21a" stroke="#5a3a06" stroke-width="4"/></svg>`,
}

const t = (text, cls = '') => `<span class="t ${cls}">${text}</span>`

// Legends window: blocky character busts, and the legend list.
const bust = (skin, hair, shirt, trim, extra = '') =>
  `<svg viewBox="0 0 100 100"><rect x="8" y="62" width="84" height="36" rx="8" fill="${shirt}" stroke="#141420" stroke-width="3"/><rect x="2" y="66" width="20" height="30" rx="5" fill="${trim}" stroke="#141420" stroke-width="3"/><rect x="78" y="66" width="20" height="30" rx="5" fill="${trim}" stroke="#141420" stroke-width="3"/><rect x="36" y="54" width="28" height="14" fill="${skin}"/><rect x="26" y="14" width="48" height="46" rx="14" fill="${skin}" stroke="#141420" stroke-width="3"/><path d="M23 34 C20 4 80 4 77 34 C72 22 62 20 50 22 C38 20 28 22 23 34Z" fill="${hair}" stroke="#141420" stroke-width="3" stroke-linejoin="round"/><circle cx="39" cy="40" r="3.2" fill="#141420"/><circle cx="61" cy="40" r="3.2" fill="#141420"/><path d="M40 50 Q50 57 60 50" stroke="#141420" stroke-width="3" fill="none" stroke-linecap="round"/>${extra}</svg>`
const CHILLI = `<svg viewBox="0 0 100 100"><path d="M46 14 C40 2 52 0 56 8 C62 4 68 10 58 16Z" fill="#2fb52a" stroke="#141420" stroke-width="3" stroke-linejoin="round"/><path d="M28 26 C28 16 72 16 72 26 L76 56 C76 70 66 82 50 84 C34 82 24 70 24 56Z" fill="#e5242b" stroke="#141420" stroke-width="3" stroke-linejoin="round"/><rect x="30" y="34" width="40" height="12" rx="5" fill="#141420"/><rect x="33" y="36" width="14" height="6" rx="2" fill="#7fc8ff"/><rect x="53" y="36" width="14" height="6" rx="2" fill="#7fc8ff"/><path d="M42 56 Q50 63 58 56" stroke="#141420" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="8" y="46" width="14" height="30" rx="5" fill="#e5242b" stroke="#141420" stroke-width="3"/><rect x="78" y="46" width="14" height="30" rx="5" fill="#e5242b" stroke="#141420" stroke-width="3"/><rect x="32" y="82" width="14" height="16" rx="3" fill="#3aa0ff" stroke="#141420" stroke-width="3"/><rect x="54" y="82" width="14" height="16" rx="3" fill="#3aa0ff" stroke="#141420" stroke-width="3"/></svg>`
const LEGEND_ICONS = {
  chilli: CHILLI,
  ronaldu: bust('#e8b48a', '#2a1a14', '#c8202c', '#0f6a46'),
  cancello: bust('#f2c08a', '#241a16', '#4aa0f0', '#8fd0ff'),
  pogbo: bust('#8a5a3a', '#1c1410', '#2a2018', '#d8a840'),
  kvarra: bust('#f2c08a', '#8a4a28', '#f4f4f4', '#f4f4f4'),
  neymer: bust('#f2c08a', '#3a2a22', '#f4f4f8', '#f4f4f8'),
  vinny: bust('#7a4a2a', '#14100c', '#ffd81a', '#b8701a'),
  sallah: bust('#c08a5a', '#4a2a1c', '#d82030', '#f2c08a'),
  yamol: bust('#c88a5a', '#3a2412', '#2a46b8', '#c42a50'),
  beckhem: bust('#f2c08a', '#f0d890', '#d82a2a', '#f2c08a'),
  kruyf: bust('#f2c08a', '#5a3a22', '#2a46b8', '#c42a50'),
  debruyn: bust('#f2c08a', '#d8a860', '#6ab4f0', '#6ab4f0'),
  haalando: bust('#f2c08a', '#e0b070', '#6ab4f0', '#6ab4f0'),
}
const legendRow = (l) => `
  <div class="lgrow ${l.limited ? 'limited' : ''} ${(l.tier ?? '').toLowerCase()}">
    <div class="lgicon">${LEGEND_ICONS[l.id]}${l.limited ? t('LIMITED', 'lgtag') : ''}</div>
    <div class="lginfo">
      <span class="t lgname">${l.tier ? `<span class="tier">${l.tier}</span> ` : ''}${l.name}</span>
      ${l.left ? t(l.left, 'lgleft') : ''}
      <div class="lgwins">${ICON.trophy}${t(`${l.mult}x Wins`)}</div>
    </div>
    <button class="lgcost studded" data-act="legend" data-id="${l.id}"></button>
  </div>`

ICON.ball = `<svg viewBox="0 0 64 64"><image href="${import.meta.env.BASE_URL}ui/soccer-ball.png" width="64" height="64"/></svg>`

const TEMPLATE = `
  <div class="topbar">
    <button class="tool autoclick" data-act="autoClick">${ICON.cursor}<span class="dot"></span>${t('Auto Click')}</button>
    <button class="kick studded" data-act="kick">${t('KICK!')}</button>
    <button class="tool autokick" data-act="autoKick">${ICON.shoe}<span class="dot"></span>${t('Auto Kick')}</button>
  </div>
  <div class="menu">
    <button class="tile studded rebirth" data-act="rebirth">${t('0%', 'pct')}${ICON.rebirth}${t('Rebirth')}</button>
    <button class="tile studded inventory" data-act="inventory">${ICON.backpack}${t('Inventory')}</button>
    <button class="tile studded legends" data-act="legends">${ICON.legend}${t('Legends')}</button>
  </div>
  <button class="spinbanner studded" data-act="openWheel">
    <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="#ffd21a" stroke="#5a3a06" stroke-width="5"/><path d="M32 6 V58 M6 32 H58 M13.6 13.6 L50.4 50.4 M50.4 13.6 L13.6 50.4" stroke="#5a3a06" stroke-width="3"/><circle cx="32" cy="32" r="7" fill="#ff5a5a" stroke="#5a3a06" stroke-width="3"/></svg>
    ${t('FREE SPIN!', 'sbtitle')}
    ${t('Ready to spin', 'sbsub')}
  </button>
  <div class="spintimers">
    ${t('Free spin every 15 min of play', 'sbl')}
    ${t('Next in 15:00', 'sbon')}
    ${t('Away 24 hrs = free spin', 'sbl')}
    ${t('Next in 24h 00m', 'sboff')}
  </div>
  <div class="counters">
    <div class="counter rebirths">${ICON.rebirth}${t('0', 'n')}</div>
    <div class="counter wins">${ICON.trophy}${t('0', 'n')}</div>
  </div>
  <div class="power">
    <div class="row">${t('Level 1', 'level')}${t('1x Multiplier', 'mult')}</div>
    <div class="bar studded"><div class="fill"></div>${t('Kick Power: 0/0', 'bartext')}</div>
  </div>
  <div class="aim">
    <div class="meter studded"><div class="mfill"></div><i></i><i></i><i></i></div>
    ${t('Tap to Kick!', 'tap')}
  </div>
  <div class="prompt t"></div>
  <div class="toast t"></div>
  <div class="levelup"><div class="levelup-t t">LEVEL UP!</div><div class="levelup-s t"></div></div>
  <div class="rating"><span class="t"></span></div>
  <div class="dist">${ICON.ball}<span class="t"></span></div>
  <div class="winsreel"><div class="wr-win"><div class="wr-strip"></div></div></div>
  <div class="bouncepop t">BOUNCE!</div>
  <div class="bouncepop bonuspop t"></div>
  <div class="zonebar studded">${ZONES.map(([n, c]) => `<div class="zone" style="--zc:${c}">${t(n)}</div>`).join('')}<div class="zmark">${ICON.ball}<div class="zdp zme"></div></div><div class="zbests"></div></div>
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
  <div class="modal wlmodal" data-act="closeWheel">
    <div class="wlwin">
      ${t('LUCKY WHEEL', 'wltitle')}
      ${t('Spins: 0', 'wlspins')}
      ${t('Free spin in: 00:00', 'wltimer')}
      <div class="wlwheel">
        <div class="wlpointer"></div>
        <canvas class="wlcanvas" width="1080" height="1080"></canvas>
      </div>
      <button class="wlspin studded" data-act="spin">${t('SPIN!')}</button>
      <button class="wlx studded" data-act="closeWheel">${t('X')}</button>
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
  <div class="modal invmodal" data-act="closeInventory">
    <div class="invwin">
      <div class="invhead studded-plate">
        ${ICON.box}${t('Inventory', 'invtitle')}
        <button class="invplus studded" data-act="invPlus" aria-label="Buy slot">${ICON.plus}</button>
        ${t('0/2', 'invcount')}
        <button class="rbclose studded" data-act="closeInventory">${t('X')}</button>
      </div>
      <div class="invbody">
        <div class="invgrid"></div>
        <div class="invdetail studded-plate"></div>
        <div class="invbtns">
          <button class="invtrash studded" data-act="invTrash" aria-label="Delete unequipped">${ICON.trash}</button>
          <button class="invbest studded" data-act="invBest">${t('Equip Best')}</button>
        </div>
      </div>
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
    autoClick: $('.autoclick'),
    autoKick: $('.autokick'),
    kickBtn: $('.kick'),
    kickLabel: $('.kick .t'),
    mfill: $('.mfill'),
    prompt: $('.prompt'),
    toast: $('.toast'),
    zonebar: $('.zonebar'),
    zones: [...root.querySelectorAll('.zonebar .zone')],
    zmark: $('.zonebar .zmark'),
    zbests: $('.zonebar .zbests'),
    zme: $('.zonebar .zme'),
    rating: $('.rating'),
    ratingText: $('.rating .t'),
    dist: $('.dist'),
    distText: $('.dist .t'),
    reel: $('.winsreel'),
    reelStrip: $('.winsreel .wr-strip'),
    bouncePop: $('.bouncepop:not(.bonuspop)'),
    bonusPop: $('.bonuspop'),
    modal: $('.modal'),
    lgModal: $('.lgmodal'),
    invModal: $('.invmodal'),
    invGrid: $('.invgrid'),
    invDetail: $('.invdetail'),
    invCount: $('.invcount'),
    invTrash: $('.invtrash'),
    invPlus: $('.invplus'),
    spinBanner: $('.spinbanner'),
    sbSub: $('.sbsub'),
    sbOn: $('.sbon'),
    sbOff: $('.sboff'),
    wlModal: $('.wlmodal'),
    wlSpins: $('.wlspins'),
    wlTimer: $('.wltimer'),
    wlCanvas: $('.wlcanvas'),
    wlSpin: $('.wlspin'),
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
  function renderLegends() {
    for (const b of root.querySelectorAll('.lgcost')) {
      const l = LEGENDS.find((x) => x.id === b.dataset.id)
      const owned = stats.legends.includes(l.id)
      const label = stats.legend === l.id ? 'Equipped' : owned ? 'Equip' : formatNumber(l.cost)
      b.innerHTML = owned ? t(label) : ICON.trophy + t(label)
      b.classList.toggle('owned', owned)
      b.classList.toggle('equipped', stats.legend === l.id)
      b.classList.toggle('off', !owned && stats.wins < l.cost)
    }
  }
  // --- Inventory: owned legends, equip / unequip / delete -----------------------------------------
  let invSel = null
  let confirmKey = '' // a delete button armed by its first click ("Sure?"), fired by the second
  let confirmTimer = 0
  const ownedLegends = () => stats.legends.map((id) => LEGENDS.find((l) => l.id === id)).filter(Boolean)
  function confirmed(key) {
    clearTimeout(confirmTimer)
    if (confirmKey === key) {
      confirmKey = ''
      return true
    }
    confirmKey = key
    confirmTimer = setTimeout(() => {
      confirmKey = ''
      renderInventory()
    }, 2500)
    renderInventory()
    return false
  }
  function renderInventory() {
    const owned = ownedLegends()
    if (!owned.some((l) => l.id === invSel)) invSel = stats.legend || owned[0]?.id || null
    el.invCount.textContent = `${owned.length}/${stats.invSlots}`
    el.invPlus.innerHTML = stats.invSlots >= LEGENDS.length ? t('MAX') : `${ICON.plus}${ICON.trophy}${t(formatNumber(invSlotCost()))}`
    el.invPlus.classList.toggle('off',stats.invSlots >= LEGENDS.length || stats.wins < invSlotCost())
    el.invGrid.innerHTML = owned
      .map(
        (l) => `<button class="invcard studded ${l.id === invSel ? 'sel' : ''}" data-act="invSelect" data-id="${l.id}">
          ${LEGEND_ICONS[l.id]}${l.id === stats.legend ? `<span class="invtick">${ICON.check}</span>` : ''}${t('x1', 'invx')}
        </button>`,
      )
      .join('')
    const l = owned.find((x) => x.id === invSel)
    el.invDetail.innerHTML = l
      ? `${t(l.name, 'dname')}
         ${l.tier ? t(l.tier, `dtier ${l.tier.toLowerCase()}`) : ''}
         <div class="dbust">${LEGEND_ICONS[l.id]}</div>
         <div class="dwins">${ICON.trophy}${t(`x${l.mult} Wins`)}</div>
         <button class="dbtn ${l.id === stats.legend ? 'red' : 'green'} studded" data-act="invEquip" data-id="${l.id}">${t(l.id === stats.legend ? 'Unequip' : 'Equip')}</button>
         <button class="dbtn red studded" data-act="invDelete" data-id="${l.id}">${t(confirmKey === `d:${l.id}` ? 'Sure?' : 'Delete')}</button>`
      : t('Nothing here yet', 'dempty')
    el.invTrash.classList.toggle('armed', confirmKey === 'trash')
    el.invTrash.classList.toggle('off', !owned.some((x) => x.id !== stats.legend))
  }
  const setInventoryOpen = (on) => {
    confirmKey = ''
    if (on) renderInventory()
    el.invModal.classList.toggle('show', on)
  }
  const setRebirthOpen = (on) => {
    if (on) renderRebirth()
    el.modal.classList.toggle('show', on)
  }
  // --- Lucky Wheel: opens when the player walks up to the wheel ---------------------------------
  const PRIZES = ECONOMY.wheelPrizes
  const SLICE = 360 / PRIZES.length
  const GLYPH = { trophy: '🏆', shoe: '👟', spin: '🔄' }
  // The RONALDU slice shows his bust (same SVG as the Legends window), drawn once it has decoded.
  const bustImg = new Image()
  bustImg.onload = () => paintWheel()
  bustImg.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(LEGEND_ICONS.ronaldu.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}`
  let wheelRot = 0 // degrees, clockwise
  let wheelSpinning = false
  function paintWheel() {
    const c = el.wlCanvas
    const g = c.getContext('2d')
    const R = c.width / 2
    g.clearRect(0, 0, c.width, c.height)
    g.fillStyle = '#4a5a1a'
    g.beginPath()
    g.arc(R, R, R - 4, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = 8
    g.strokeStyle = '#1b1b28'
    g.stroke()
    const r = R - 56
    PRIZES.forEach((p, i) => {
      const a0 = ((i * SLICE - 90) * Math.PI) / 180
      const a1 = (((i + 1) * SLICE - 90) * Math.PI) / 180
      g.fillStyle = p.color
      g.beginPath()
      g.moveTo(R, R)
      g.arc(R, R, r, a0, a1)
      g.closePath()
      g.fill()
      g.lineWidth = 6
      g.strokeStyle = '#1b1b28'
      g.stroke()
      g.save()
      g.translate(R, R)
      g.rotate(((i + 0.5) * SLICE * Math.PI) / 180) // slice centre points up, then text reads outward
      g.textAlign = 'center'
      g.lineJoin = 'round'
      g.font = '800 54px Fredoka, "Fredoka One", sans-serif'
      g.lineWidth = 10
      g.strokeStyle = '#1b1b28'
      g.fillStyle = '#fff'
      g.strokeText(p.label, 0, -r + 78)
      g.fillText(p.label, 0, -r + 78)
      if (p.icon === 'legend') {
        if (bustImg.complete && bustImg.naturalWidth) g.drawImage(bustImg, -62, -r + 120, 124, 124)
      } else {
        g.font = '110px sans-serif'
        g.fillText(GLYPH[p.icon] ?? '', 0, -r + 230)
      }
      g.font = '800 42px Fredoka, sans-serif'
      g.lineWidth = 8
      g.strokeText(`${p.chance}%`, 0, -r + 300)
      g.fillText(`${p.chance}%`, 0, -r + 300)
      g.restore()
    })
    g.fillStyle = '#ffd21a'
    g.strokeStyle = '#1b1b28'
    g.lineWidth = 8
    g.beginPath()
    g.arc(R, R, 34, 0, Math.PI * 2)
    g.fill()
    g.stroke()
  }
  function renderWheel() {
    const m = freeSpinLeft()
    el.wlSpins.textContent = `Spins: ${stats.spins}`
    el.wlTimer.textContent = `Free spin in: ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    el.wlSpin.classList.toggle('off', wheelSpinning || stats.spins < 1)
    renderSpinBanner()
  }
  // Banner stays up while any spin is in stock; hidden while the wheel window is open.
  function renderSpinBanner() {
    const show = stats.spins >= 1 && !el.wlModal.classList.contains('show')
    el.spinBanner.classList.toggle('show', show)
    el.sbSub.textContent = stats.spins > 1 ? `${stats.spins} spins ready` : 'Tap to spin'
  }
  // Online: next spin after 30 min of play (mm:ss). Offline: a spin per 24h away (h + m left since last seen).
  function renderSpinTimers() {
    const m = freeSpinLeft()
    el.sbOn.textContent = `Next in ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    const away = Math.max(0, ECONOMY.offlineSpinSeconds - Math.floor((Date.now() - stats.lastSeen) / 1000))
    el.sbOff.textContent = `Next in ${Math.floor(away / 3600)}h ${String(Math.floor((away % 3600) / 60)).padStart(2, '0')}m`
  }
  function openWheel() {
    paintWheel()
    renderWheel()
    el.wlModal.classList.add('show')
    renderSpinBanner()
  }
  function closeWheel() {
    if (!wheelSpinning) el.wlModal.classList.remove('show') // the result lands first
    renderSpinBanner()
  }
  function spinWheel() {
    if (wheelSpinning) return
    if (!useSpin()) return toast('No spins left', true)
    wheelSpinning = true
    renderWheel()
    let roll = Math.random() * PRIZES.reduce((s, p) => s + p.chance, 0)
    let win = PRIZES.findIndex((p) => (roll -= p.chance) < 0)
    if (win < 0) win = 0
    const centre = (win + 0.5) * SLICE
    const jitter = (Math.random() - 0.5) * SLICE * 0.7
    const turn = wheelRot - (wheelRot % 360) + 360 * 6 + (360 - centre + jitter) // lands the slice under the top pointer
    wheelSpinSound(wheelRot, turn - wheelRot, SLICE, 4.6)
    wheelRot = turn
    el.wlCanvas.style.transition = 'transform 4.6s cubic-bezier(0.12, 0.7, 0.1, 1)'
    el.wlCanvas.style.transform = `rotate(${turn}deg)`
    const done = () => {
      el.wlCanvas.removeEventListener('transitionend', done)
      clearTimeout(fallback)
      wheelSpinning = false
      grantPrize(PRIZES[win])
      wheelWinSound()
      toast(`You won ${PRIZES[win].label}!`)
      renderWheel()
    }
    const fallback = setTimeout(done, 5200) // transitionend never fires in a hidden tab
    el.wlCanvas.addEventListener('transitionend', done)
  }
  setInterval(() => {
    if (el.wlModal.classList.contains('show')) renderWheel()
    renderSpinTimers()
  }, 500)
  // FREE SPIN! toast for a spin earned by playtime or by coming back after 24h+.
  function announceFreeSpin() {
    const n = freeSpinNotice.count
    if (!n) return
    freeSpinNotice.count = 0
    toast(n > 1 ? `FREE SPIN! x${n}` : 'FREE SPIN!', 'good')
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      setRebirthOpen(false)
      el.lgModal.classList.remove('show')
      setInventoryOpen(false)
      closeWheel()
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
    el.autoClick.classList.toggle('on', stats.autoClick)
    el.autoKick.classList.toggle('on', stats.autoKick)
  }

  // One banner for every message. "Needs ..." prompts (locked ball / field) stay up in red while
  // the player stands there; a timed toast takes the banner over and hands it back afterwards.
  let toastTimer = 0
  let toastBusy = false
  let sticky = ''
  function showSticky() {
    el.toast.textContent = sticky
    el.toast.classList.add('bad')
    el.toast.classList.toggle('show', !!sticky)
  }
  // Error sound: one preloaded element, restarted per error (same pattern as the kick tick).
  const errorSfxEl = new Audio(`${import.meta.env.BASE_URL}audio/error.mp3`)
  errorSfxEl.preload = 'auto'
  errorSfxEl.volume = 0.25
  function errorSfx() {
    try {
      errorSfxEl.currentTime = 0
      errorSfxEl.play()?.catch(() => {})
    } catch {}
  }
  function toast(text, bad = false) {
    if (bad === true) errorSfx()
    el.toast.textContent = text
    el.toast.classList.toggle('bad', bad === true)
    el.toast.classList.toggle('good', bad === 'good')
    el.toast.classList.add('show')
    toastBusy = true
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toastBusy = false
      if (sticky) showSticky()
      else el.toast.classList.remove('show')
    }, 1600)
  }

  // Kick feedback: the rating banner, the live distance tag that rides next to the
  // ball, and the BOUNCE! pop. Each restarts its CSS animation when retriggered.
  const restart = (node, cls) => {
    node.classList.remove(cls)
    void node.offsetWidth
    node.classList.add(cls)
  }
  let distTimer = 0
  let reelTimer = 0
  // Win jingle plays for the whole reel spin (the reel's duration matches the clip length).
  const reelSfx = new Audio(`${import.meta.env.BASE_URL}audio/slot-machine-win.mp3`)
  reelSfx.preload = 'auto'
  reelSfx.volume = KICKBALL.winsReel.volume
  const kickFx = {
    rating(text, tier) {
      el.ratingText.textContent = text
      el.rating.className = `rating ${tier}`
      restart(el.rating, 'show')
    },
    // metres + the ball's screen position (px); null position keeps the last one.
    distance(metres, pos) {
      clearTimeout(distTimer)
      el.distText.textContent = `${Math.floor(metres)}m`
      if (pos) {
        el.dist.style.left = `${pos.x}px`
        el.dist.style.top = `${pos.y}px`
      }
      el.dist.classList.add('show')
      el.dist.classList.remove('final')
      // Top zone bar: slide the ball marker and light up the zone it is in.
      const f = Math.min(1, Math.max(0, metres / ECONOMY.laneLength))
      const zi = Math.min(ZONES.length - 1, Math.floor(f * ZONES.length))
      el.zonebar.classList.add('show')
      el.zmark.style.left = `${f * 100}%`
      el.zones.forEach((z, i) => z.classList.toggle('active', i === zi))
    },
    // The ball landed: pop the final number, then fade it out.
    distanceDone(metres) {
      el.distText.textContent = `${metres.toFixed(metres < 10 ? 1 : 0)}m`
      restart(el.dist, 'final')
      el.zonebar.classList.remove('show')
    },
    // The landed result (distance tag + wins reel) stays until the camera has reset.
    hideResult() {
      clearTimeout(distTimer)
      clearTimeout(reelTimer)
      el.dist.classList.remove('show', 'final')
      el.reel.classList.remove('show', 'locked', 'spin')
    },
    // Slot-machine reel of "+N Wins" rows above the ball: spins, decelerates, locks on `wins`.
    winsReel(wins, pos, onLock) {
      clearTimeout(reelTimer)
      const { rows, spinSeconds } = KICKBALL.winsReel
      try {
        reelSfx.currentTime = 0
        reelSfx.play()?.catch(() => {})
      } catch {}
      const list = []
      for (let i = 0; i < rows; i++) list.push(Math.max(1, Math.round(wins * (0.15 + Math.random() * 1.7))))
      list.push(wins, Math.max(1, Math.round(wins * (0.3 + Math.random()))))
      el.reelStrip.innerHTML = list.map((n, i) => `<div class="wr-row${i === rows ? ' fin' : ''}">+${formatNumber(n)} Wins</div>`).join('')
      el.reel.style.setProperty('--rows', rows - 1) // the final row ends up in the middle of the 3-row window
      el.reel.style.setProperty('--spin', `${spinSeconds}s`)
      el.reel.classList.remove('locked', 'spin')
      restart(el.reel, 'show')
      el.reelStrip.style.transition = 'none'
      el.reelStrip.style.transform = 'translateY(0)'
      void el.reelStrip.offsetWidth
      el.reelStrip.style.transition = ''
      el.reelStrip.style.transform = ''
      el.reel.classList.add('spin')
      reelTimer = setTimeout(() => {
        el.reel.classList.add('locked')
        onLock?.()
      }, spinSeconds * 1000)
    },
    bounce() {
      restart(el.bouncePop, 'show')
    },
    bonus(pct) {
      el.bonusPop.textContent = `[+${pct}%] WINS!`
      restart(el.bonusPop, 'show')
    },
  }

  let lastPrompt = null
  function setPrompt(text) {
    if (text === lastPrompt) return
    lastPrompt = text
    const needs = text && /^Needs /.test(text) ? text : ''
    if (needs !== sticky) {
      sticky = needs
      if (!toastBusy) {
        if (sticky) showSticky()
        else el.toast.classList.remove('show')
      }
    }
    const shown = needs ? '' : isTouch ? (text ?? '').replace('Press E to', 'Tap to') : (text ?? '') // touch: the prompt is the E button
    el.prompt.textContent = shown
    el.prompt.classList.toggle('show', !!shown)
    el.prompt.classList.toggle('good', /^Training:/.test(shown))
  }

  // One kick: stats, then a floating "+N" under the KICK button. `power` (0..1)
  // comes from the aim meter and scales both the stats gain and the ball's speed.
  let onKick = () => {}
  let headAnchor = () => null // px position above the player's head, set by main.js
  // Power-gain tick sound (from Clean Leaves): one preloaded element, restarted per kick.
  const gainSfx = new Audio(`${import.meta.env.BASE_URL}audio/power_gain.mp3`)
  gainSfx.preload = 'auto'
  gainSfx.volume = 0.3
  let lastKickAt = -Infinity // ms; any kick (manual or auto) inside ECONOMY.kickCooldown is ignored
  function kickNow(power = 1, gainOnly = false) {
    const now = performance.now()
    if (now - lastKickAt < ECONOMY.kickCooldown * 1000) return
    lastKickAt = now
    try {
      gainSfx.currentTime = 0
      gainSfx.play()?.catch(() => {})
    } catch {}
    if (!gainOnly) onKick(power)
    const { gain } = kick(0.5 + 0.5 * power)
    const pop = document.createElement('span')
    pop.className = 't pop'
    pop.innerHTML = `${ICON.shoe}<span>+${formatNumber(gain)}</span>` // same shoe icon as Auto Kick
    const head = headAnchor()
    if (head) {
      // Rises from above the player's head, jittered so rapid clicks don't stack.
      pop.classList.add('up')
      pop.style.left = `${head.x + (Math.random() - 0.5) * 90}px`
      pop.style.top = `${head.y + (Math.random() - 0.5) * 40}px`
    } else {
      const r = el.kickBtn.getBoundingClientRect()
      pop.style.left = `${r.left + r.width * (0.2 + Math.random() * 0.6)}px`
      pop.style.top = `${r.bottom + 6}px`
    }
    root.appendChild(pop)
    pop.addEventListener('animationend', () => pop.remove())
  }

  // "LEVEL UP!" banner: replays whenever the level rises (a rebirth reset or save load does not trigger it).
  const levelUp = $('.levelup')
  const levelUpSub = $('.levelup-s')
  const levelUpSfx = new Audio(`${import.meta.env.BASE_URL}audio/level_up.mp3`)
  levelUpSfx.preload = 'auto'
  levelUpSfx.volume = 0.4
  const LEVEL_UP_MS = { inMs: 420, holdMs: 900, outMs: 560 }
  let lastLevel = stats.level
  let levelUpAnim = null
  function renderLevelUp() {
    if (stats.level > lastLevel) {
      try {
        levelUpSfx.currentTime = 0
        levelUpSfx.play()?.catch(() => {})
      } catch {}
      levelUpSub.textContent = `Level ${formatNumber(stats.level)}`
      const { inMs, holdMs, outMs } = LEVEL_UP_MS
      const total = inMs + holdMs + outMs
      levelUpAnim?.cancel()
      levelUpAnim = levelUp.animate(
        [
          { opacity: 0, transform: 'translateX(-50%) translateY(14px) scale(0.4)', offset: 0 },
          { opacity: 1, transform: 'translateX(-50%) scale(1.14)', offset: (inMs * 0.62) / total },
          { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: inMs / total },
          { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: (inMs + holdMs) / total },
          { opacity: 0, transform: 'translateX(-50%) translateY(calc(var(--k) * -46)) scale(1)', offset: 1 },
        ],
        { duration: total, easing: 'ease-out' },
      )
    }
    lastLevel = stats.level
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
  // The Auto Click toggle (gainOnly) only gains power: no ball is launched.
  function autoKick(gainOnly = false) {
    if (!gainOnly && inLane && (aiming || isBusy())) return
    kickNow(1, gainOnly)
  }

  // Auto Kick: in the kick lane it taps the Tap to Kick meter for you, but only ever lands 0%-50% power.
  function autoLaneKick() {
    if (!inLane || isBusy()) return
    setAiming(false)
    kickNow(Math.random() * 0.5)
  }

  const actions = {
    menu: showMenu,
    kick: () => (aiming ? setAiming(false) : doKick()), // KICK! opens the meter, CANCEL closes it
    autoClick: () => toast(toggle('autoClick') ? 'Auto Click ON' : 'Auto Click OFF'),
    autoKick: () => toast(toggle('autoKick') ? 'Auto Kick ON' : 'Auto Kick OFF'),
    rebirth: () => setRebirthOpen(true),
    closeRebirth: () => setRebirthOpen(false),
    doRebirth: () => {
      if (!rebirth()) return toast(`Need Level ${rebirthLevel()} to rebirth`, true)
      setRebirthOpen(false)
      toast(`Rebirth ${stats.rebirths}!`)
    },
    inventory: () => setInventoryOpen(true),
    closeInventory: () => setInventoryOpen(false),
    invSelect: (btn) => {
      invSel = btn.dataset.id
      renderInventory()
    },
    invEquip: (btn) => {
      if (stats.legend === btn.dataset.id) unequipLegend()
      else useLegend(btn.dataset.id)
    },
    invDelete: (btn) => {
      if (!confirmed(`d:${btn.dataset.id}`)) return
      deleteLegends([btn.dataset.id])
      toast('Deleted')
    },
    invTrash: () => {
      const ids = ownedLegends().filter((l) => l.id !== stats.legend).map((l) => l.id)
      if (!ids.length) return toast('Nothing to delete', true)
      if (!confirmed('trash')) return
      toast(`Deleted ${deleteLegends(ids)}`)
    },
    invPlus: () => {
      const r = buyInvSlot()
      toast(r === 'bought' ? 'Slot added!' : r === 'max' ? 'Inventory is maxed' : `Need ${formatNumber(invSlotCost())} wins`, r !== 'bought')
    },
    invBest: () => equipBestLegend() ? toast('Best equipped', 'good') : toast('Already the best'),
    legends: () => {
      renderLegends()
      el.lgModal.classList.add('show')
    },
    legend: (btn) => {
      const l = LEGENDS.find((x) => x.id === btn.dataset.id)
      const r = useLegend(l.id)
      if (r === 'locked') return toast(`Need ${formatNumber(l.cost)} wins`, true)
      if (r === 'full') return toast('Inventory full - press + to add a slot', true)
      if (r !== 'already') toast(r === 'bought' ? `Bought ${l.name}!` : `${l.name} equipped`, 'good')
      renderLegends()
    },
    closeLegends: () => el.lgModal.classList.remove('show'),
    closeWheel,
    openWheel,
    spin: spinWheel,
  }
  // No focus on mousedown: Space (jump) must never re-click a HUD button.
  root.addEventListener('mousedown', (e) => e.preventDefault())
  root.addEventListener('click', (e) => {
    if (aiming && e.target.closest('.aim')) return doKick()
    const btn = e.target.closest('[data-act]')
    if (!btn) return
    // The backdrop closes the window; clicks inside it (not on a button) must not.
    if (btn.classList.contains('modal') && e.target !== btn) return
    actions[btn.dataset.act]?.(btn)
  })

  onStats(() => {
    announceFreeSpin()
    render()
    renderLevelUp()
    if (el.modal.classList.contains('show')) renderRebirth()
    if (el.lgModal.classList.contains('show')) renderLegends()
    if (el.invModal.classList.contains('show')) renderInventory()
    if (el.wlModal.classList.contains('show')) renderWheel()
    else renderSpinBanner()
  })
  announceFreeSpin()
  render()
  renderSpinBanner()
  const windowOpen = () => !!root.querySelector('.modal.show')
  // Longest-kick markers on the zone bar: `own` { metres, pfp } (gold, BEST tag) and `others` [{ id, name, pfp, metres }]
  // with their profile pictures. Rebuilt only when something changed.
  let bestsKey = ''
  const MAX_OTHERS = 8
  function setBests(own, others) {
    const fill = (dp, name, pfp) => {
      dp.replaceChildren()
      if (pfp) {
        const img = document.createElement('img')
        img.src = pfp
        img.alt = ''
        img.referrerPolicy = 'no-referrer'
        img.onerror = () => img.remove()
        dp.append(img)
      }
      dp.append(document.createTextNode(name.slice(0, 1).toUpperCase()))
    }
    // My DP rides under the travelling ball icon.
    if (el.zme.dataset.pfp !== own.pfp) {
      el.zme.dataset.pfp = own.pfp
      fill(el.zme, 'You', own.pfp)
    }
    const list = others.slice(0, MAX_OTHERS)
    const key = JSON.stringify([own, list])
    if (key === bestsKey) return
    bestsKey = key
    el.zbests.replaceChildren()
    const add = (cls, name, pfp, metres, tag) => {
      const m = document.createElement('div')
      m.className = `zbest ${cls}`
      m.style.left = `${Math.min(1, metres / ECONOMY.laneLength) * 100}%`
      m.title = `${name}: ${Math.floor(metres)}m`
      const dp = document.createElement('div')
      dp.className = 'zdp'
      fill(dp, name, pfp)
      const label = document.createElement('div')
      label.className = 'zlabel'
      label.textContent = tag ? `BEST ${Math.floor(metres)}m` : `${Math.floor(metres)}m`
      m.append(dp, label)
      el.zbests.append(m)
    }
    for (const o of [...list].reverse()) add('other', o.name, o.pfp, o.metres, false)
    if (own.metres > 0) add('own', 'You', own.pfp, own.metres, true)
  }

  return { setBests, windowOpen, openWheel, doKick, autoKick, autoLaneKick, setBusyCheck: (fn) => (isBusy = fn), setOnAim: (fn) => (onAim = fn), setPrompt, setLane, toast, setOnKick: (fn) => (onKick = fn), setHeadAnchor: (fn) => (headAnchor = fn), kickFx }
}
