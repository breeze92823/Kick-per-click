// Phones and tablets: a coarse primary pointer with no hover. Evaluated once; the HUD reads
// `isCompact` live (it also covers small desktop windows).
const mq = (q) => typeof matchMedia === 'function' && matchMedia(q).matches
export const isTouch = mq('(pointer: coarse)') && !mq('(hover: hover) and (pointer: fine)')
export const isCompact = () => isTouch || window.innerWidth < 900 || window.innerHeight < 520

// Publishes the viewport to CSS: --W / --H (real px, unlike 100vh this follows the mobile URL bar),
// --k0 (px per HUD unit: 1920x991 grid on desktop, a 1000x500 grid when compact) and html.compact.
export function installViewport() {
  const root = document.documentElement
  const fit = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const compact = isCompact()
    root.classList.toggle('compact', compact)
    root.style.setProperty('--W', `${w}px`)
    root.style.setProperty('--H', `${h}px`)
    root.style.setProperty('--k0', `${compact ? Math.min(w / 1000, h / 500) : Math.min(w / 1920, h / 991)}px`)
  }
  window.addEventListener('resize', fit)
  window.addEventListener('orientationchange', fit)
  fit()
}
