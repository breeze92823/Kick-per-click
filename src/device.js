// Phones and tablets: a coarse primary pointer with no hover. Evaluated once; the HUD reads
// `isCompact` live (it also covers small desktop windows).
const mq = (q) => typeof matchMedia === 'function' && matchMedia(q).matches
export const isTouch = mq('(pointer: coarse)') && !mq('(hover: hover) and (pointer: fine)')
export const isCompact = () => isTouch || window.innerWidth < 900 || window.innerHeight < 520
