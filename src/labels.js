// Floating text (Roblox BillboardGui style): chunky outlined lettering on a
// camera-facing sprite. Every painted canvas re-renders once the web font lands.
import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial } from 'three'
import { UI_FONT } from './config.js'
import { makeCanvas } from './textures.js'

export const font = (px) => `700 ${px}px ${UI_FONT}`
const INK = '#1b1b26'
const RES = 2 // canvas pixels per label pixel, for crisp edges

// Vertical two-stop fills by name; any other string is a flat colour.
const FILLS = {
  gold: ['#fff36b', '#ffab17'],
  white: ['#ffffff', '#e6eeff'],
  purple: ['#ff86f4', '#9238ff'],
  cyan: ['#93f9ff', '#2a86ff'],
  green: ['#b6ff6c', '#28cc2c'],
  red: ['#ff6a6a', '#e01818'],
}
const RAINBOW = ['#ff3a3a', '#ff9a1a', '#ffe01a', '#4ee02a', '#1ad0ff', '#4a6aff', '#c03aff']

// Re-run painters when the font arrives (the first paint may use the fallback).
const painters = new Set()
export function whenFontsReady(paint) {
  painters.add(paint)
  paint()
}
if (typeof document !== 'undefined' && document.fonts) {
  const repaint = () => painters.forEach((fn) => fn())
  document.fonts.addEventListener?.('loadingdone', repaint)
  document.fonts.ready.then(repaint)
  document.fonts.load(font(64)).then(repaint, () => {})
}

// One line of outlined text; `align` is 'center', 'left' or 'right' (x is that edge).
export function paintText(g, text, x, y, px, fill = 'white', stroke = INK, align = 'center') {
  g.font = font(px)
  g.textBaseline = 'middle'
  g.textAlign = 'left'
  g.lineJoin = 'round'
  const w = g.measureText(text).width
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  g.lineWidth = px * 0.22
  g.strokeStyle = stroke
  g.strokeText(text, left, y)
  if (fill === 'rainbow') {
    let n = 0
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ' ') continue
      g.fillStyle = RAINBOW[n++ % RAINBOW.length]
      g.fillText(text[i], left + g.measureText(text.slice(0, i)).width, y)
    }
    return w
  }
  const [a, b] = FILLS[fill] ?? [fill, fill]
  const grad = g.createLinearGradient(0, y - px * 0.45, 0, y + px * 0.45)
  grad.addColorStop(0, a)
  grad.addColorStop(1, b)
  g.fillStyle = grad
  g.fillText(text, left, y)
  return w
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

const rebirthImg = new Image()
if (typeof document !== 'undefined') {
  rebirthImg.onload = () => painters.forEach((fn) => fn())
  rebirthImg.src = `${import.meta.env.BASE_URL}ui/rebirth.png`
}

// Small icons drawn inline with text: 'gem' (premium currency) and 'rebirth'.
export function paintIcon(g, kind, cx, cy, s) {
  g.lineJoin = 'round'
  if (kind === 'gem') {
    const hex = (r) => {
      g.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      }
      g.closePath()
    }
    hex(s * 0.48)
    g.fillStyle = '#4fdc36'
    g.fill()
    g.lineWidth = s * 0.12
    g.strokeStyle = '#123f14'
    g.stroke()
    hex(s * 0.2)
    g.fillStyle = '#c4ff9a'
    g.fill()
    return
  }
  // Rebirth: the shared HUD icon image (repaints once it has loaded).
  if (rebirthImg.complete && rebirthImg.naturalWidth) g.drawImage(rebirthImg, cx - s / 2, cy - s / 2, s, s)
}

function measure(g, line) {
  g.font = font(line.px)
  const icon = line.icon ? line.px * 1.15 : 0
  const pad = line.badge ? line.px * 0.45 : 0
  return { w: g.measureText(line.text).width + icon + pad * 2, h: line.px * (line.badge ? 1.6 : 1.2) }
}

function paintLine(g, line, cx, cy, w) {
  const { px } = line
  let x = cx - w / 2
  if (line.badge) {
    roundRect(g, x, cy - px * 0.72, w, px * 1.44, px * 0.25)
    g.fillStyle = line.badge === true ? '#262633' : line.badge
    g.fill()
    g.lineWidth = px * 0.1
    g.strokeStyle = '#5a5a70'
    g.stroke()
    x += px * 0.45
  }
  if (line.icon) {
    paintIcon(g, line.icon, x + px * 0.5, cy, px)
    x += px * 1.15
  }
  paintText(g, line.text, x, cy, px, line.fill ?? 'white', line.stroke ?? INK, 'left')
}

// lines: [{ text, px, fill?, stroke?, icon?: 'gem'|'rebirth', badge?: true|colour }]
// `scale` is metres per label pixel. The sprite's anchor is its bottom centre.
export function makeLabel(lines, { scale = 0.02 } = {}) {
  const canvas = makeCanvas(2, 2)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
  sprite.center.set(0.5, 0)
  let current = lines
  const paint = () => {
    const g = canvas.getContext('2d')
    const sizes = current.map((l) => measure(g, l))
    const edge = Math.max(...current.map((l) => l.px)) * 0.2
    const W = Math.ceil(Math.max(...sizes.map((s) => s.w)) + edge * 2)
    const H = Math.ceil(sizes.reduce((a, s) => a + s.h, 0) + edge * 2)
    canvas.width = W * RES
    canvas.height = H * RES
    g.scale(RES, RES)
    let y = edge
    current.forEach((l, i) => {
      paintLine(g, l, W / 2, y + sizes[i].h / 2, sizes[i].w)
      y += sizes[i].h
    })
    tex.dispose() // the canvas may have changed size: re-allocate on the GPU
    tex.needsUpdate = true
    sprite.scale.set(W * scale, H * scale, 1)
  }
  sprite.setLines = (next) => {
    current = next
    paint()
  }
  whenFontsReady(paint)
  return sprite
}
