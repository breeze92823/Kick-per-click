// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'kick-per-click' // slug registered on bloxity.io
export const GAME_TITLE = 'Kick per Click'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

// Colyseus game server (Kick-per-click-backend), one URL per Bloxity Legion channel: `npm run build`
// (production) reads _MAIN, `npm run dev` and `npm run build:dev` read _DEV (`npm run dev` defaults to
// the local server). Empty = net.js asks the Bloxity SDK for the channel's endpoint; with no SDK either
// the game is offline (localStorage saving only, no other players).
const SERVER_URL_DEV = import.meta.env.VITE_SERVER_URL_DEV || (import.meta.env.DEV ? 'ws://localhost:2567' : '')
const SERVER_URL_MAIN = import.meta.env.VITE_SERVER_URL_MAIN || ''
export const SERVER_URL = import.meta.env.MODE === 'production' ? SERVER_URL_MAIN : SERVER_URL_DEV
export const NET = {
  poseHz: 15, // pose messages per second
  saveDebounce: 1.5, // s of quiet after a state change before saving
  saveMaxWait: 8, // s: a continuous change stream (kicking) still saves this often
  remoteLerp: 12, // 1/s: how fast remote players ease toward their last reported pose
  remoteFade: 120, // m: remote players further away than this are hidden
  maxRemotes: 24, // drawn at once (nearest first)
}

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
export const GROUND_Y = 0
export const GROUND_SIZE = 440 // square stud-plate ground, centred on the origin
export const WORLD_BOUNDS = { minX: -215, maxX: 215, minZ: -215, maxZ: 625 } // invisible backstop (maxZ: past the lane end, see LANE); backend constants.ts keeps a little slack
export const SPAWN = { x: 0, y: 0.6, z: 0 } // on top of the football spawn pad
export const SPAWN_FACING = 0 // yaw the character faces on spawn (0 = toward +Z: landmarks, then the kick lane)

// --- Map layout (arena.js, landmarks.js) ---------------------------------------
// The play area is a walled arena; the long kick lane runs south out of it.
const ARENA_MAX_Z = 40 // south edge of the plaza: the lane (and the distance count) starts here
// The kick lane: one equal-length section per ZONES entry (HUD zone bar), measured from ARENA.maxZ.
// Everything that needs a distance (HUD zones, wins, ball range, lane end) reads from here.
export const LANE = { length: 550, sections: 11, originZ: ARENA_MAX_Z }
LANE.sectionLength = LANE.length / LANE.sections // 50 m
export const ARENA = {
  minX: -46,
  maxX: 46,
  minZ: -46,
  maxZ: ARENA_MAX_Z,
  wallThickness: 6, // m per cliff ring (two rings, the outer one taller)
  wallHeight: { min: 18, max: 28 },
  column: 4, // m per cliff column along a wall
  lane: { minX: -12, maxX: 12, endZ: ARENA_MAX_Z + LANE.length, drop: 3, wallHeight: { min: 12, max: 18 } },
}
export const SPAWN_PAD_RADIUS = 4.6

// Landmark centres. Each faces the spawn unless it says otherwise.
export const SITES = {
  training: { x: -33, z: -2 }, // row of training goals on the west side; faces east
  wheel: { x: -12, z: 14 },
  signBoard: { x: -21, z: 17 },
  chest: { x: -14, z: -18 },
  leaderboards: { x: 0, z: -35 }, // three boards against the north wall; faces south
  noob: { x: 13, z: -17 },
  upgrades: { x: 30, z: -6 },
  chili: { x: 9, z: 11 },
  beachPortal: { x: 12, z: 16 },
}

// Flush grass lawns with a thin orange outline. A lawn is one rect, or `parts`
// (axis-aligned rects [x, z, w, d]) stepped into a staircase shape.
export const LAWNS = [
  { parts: [[-15, 14, 20, 12], [-8, 6.5, 6, 3]] }, // wheel + sign board
  { parts: [[12, 16, 16, 12], [15, 8.5, 10, 3], [17.5, 5.5, 5, 3]] }, // Beach World portal + chili
  { parts: [[-16, -18, 20, 9], [-26, -25.5, 14, 12]] }, // chest + north end of the goals row
  { x: 0, z: -34, w: 40, d: 9, rot: 0 }, // leaderboards
  { x: 13, z: -17, w: 14, d: 9, rot: 0 }, // noob
  // Arena corners: grass against the cliffs, stepped toward the middle road.
  { parts: [[-37, -38, 18, 16], [-40.5, -26, 11, 8]] }, // north-west
  { parts: [[37, -38, 18, 16], [40.5, -26, 11, 8]] }, // north-east
  { parts: [[-37, 34.5, 18, 11], [-40.5, 25, 11, 8]] }, // south-west
  { parts: [[37, 34.5, 18, 11], [40.5, 25, 11, 8]] }, // south-east
  // Wall strips: grass between the cliffs and the landmarks that stand near them.
  { x: 0, z: -41, w: 56, d: 10, rot: 0 }, // behind the leaderboards
  { x: 37, z: 17, w: 18, d: 8, rot: 0 }, // south of the upgrade hill
  { x: -42.3, z: -2, w: 7.4, d: 42, rot: 0 }, // behind the training goals
  { x: -20, z: 30.5, w: 16, d: 19, rot: 0 }, // south wall, beside the sign board lawn
  { x: 20, z: 30.5, w: 16, d: 19, rot: 0 }, // south wall, beside the Beach World lawn
  // Fillers where the strips meet the corner lawns.
  { x: 31.5, z: 25, w: 7, d: 8, rot: 0 },
  { x: -31.5, z: 25, w: 7, d: 8, rot: 0 },
  { x: 24, z: -32, w: 8, d: 7, rot: 0 },
  { x: -24, z: -32, w: 8, d: 7, rot: 0 },
]

// --- Physics feel (player.js, colliders.js) ------------------------------------
export const PHYSICS = {
  moveSpeed: 10, // m/s on flat ground
  accel: 75, // m/s^2 toward the target velocity (full speed in ~0.13 s)
  decel: 69, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  aimTurnSpeed: 20, // rad/s the body turns to face the camera while the action is held
  gravity: -22, // m/s^2
  jumpSpeed: 7.5, // m/s
  stepUp: 0.6, // tallest ledge walked up without jumping
  coyoteTime: 0.08, // s after leaving a ledge a jump is still allowed
  jumpBuffer: 0.12, // s a jump press is remembered before landing
  killY: -30, // fell this far below the ground: respawn
}
export const PLAYER_DIMS = { radius: 0.4, height: 1.8 }

// --- Look ------------------------------------------------------------------
export const COLORS = {
  horizon: '#d6ecff',
  skyMid: '#6fb2ff',
  zenith: '#2f45f2',
  floor: '#fcb878',
  floorDark: '#f29a55',
  floorLight: '#ffd0a0',
  floorSeam: '#e5883f',
  wall: '#ee7543',
  curb: '#e0672f',
  grass: '#8ade2e',
  lawn: '#a6ef22', // flush lawns and lane flanks
  sand: '#f6e2b0', // pale strip where the plaza meets the lane
  grassDark: '#6ec522',
  leaf: '#8fe03c',
  leafDark: '#6cc92c',
  pine: '#3fb04a',
  pineDark: '#2f9640',
  trunk: '#8a5a35',
  rock: '#7d98dc',
  stone: '#a9a9b8',
  stoneDark: '#8a8a9c',
  padWhite: '#f2f2f5',
  padDark: '#4c4c58',
  padSeam: '#7b7b88',
  padRim: '#3f3f4b',
}
export const FOG = { near: 160, far: 600 }

// Sky dome (world.js): gradient, two rainbows, procedural clouds, sun disc.
export const SKY = { radius: 900, cloudScale: 1.3, cloudCover: 0.5 }

// Font for the HUD and all in-world labels (Google Fonts link in index.html).
export const UI_FONT = '"Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif'

// --- Controls ------------------------------------------------------------------
// First key/click captures the mouse for mouse-look; Esc frees it. The cursor is freed automatically
// while a HUD window or the Tap to Kick meter is up (world click / F still kick). false = always free, right-drag orbits.
export const CONTROLS = { pointerLock: true }

// --- Economy (stats.js) --------------------------------------------------------
// The kicked ball (ballKick.js, kickPlan.js): arcs down the lane joined by BOUNCE! rings; it lands and stops (no bounce).
export const KICKBALL = {
  gravity: 25, // m/s^2
  // Range (metres, full power) = LANE.length * (log10(1 + S) / log10(1 + refKick * refLevel)) ^ curve,
  // with S = equipped ball kick * Kick Power level. The reference state (ball +56 at Kick Power level 100)
  // lands exactly on the lane end; any stronger product is capped there (kickPlan.js solves the flight).
  range: { refKick: 56, refLevel: 100, curve: 1.5, minRange: 12 },
  // The first arc's peak (m above the launch) grows with the ball's range: minApex at 0 m, maxApex at the lane end.
  arc: { minApex: 3, maxApex: 32, curve: 0.8 },
  // BOUNCE! rings keep the ball skipping down the lane: one ring per `every` m of range (up to `max`).
  // The first arc peaks at `arc`; rings sit at `ringHeight` of that peak (above the floor); each ring
  // re-lifts the ball so the next skip climbs `rise` of the peak above it (see kickPlan.js).
  // Rings sit at random left/right offsets: each within the steering reach (`reach` of what the ball can cover
  // in that arc) of the previous one, at least `minShift` m away from it, inside the walls by `edge` m.
  rings: { max: 10, every: 80, ringHeight: 0.55, rise: 0.22, reach: 0.6, minShift: 4, edge: 3 },
  // Bonus Win ring: now and then (`chance` per kick, only for kicks of at least `minRange` m) one extra ring
  // hangs in the flight, between `from` and `to` of the flight time, at least `gap` s from any BOUNCE! ring and
  // within `reach` of what steering can cover. Flying through it adds `pct` % of the base wins (before the
  // multipliers). Tier odds are the `weight`s.
  bonusRing: {
    chance: 0.35, minRange: 60, from: 0.2, to: 0.92, gap: 0.6, reach: 0.45,
    // All tiers share the same mint-green look; only the % differs.
    tiers: [25, 50, 100].map((pct, i) => ({
      pct, weight: [60, 30, 10][i], color: '#22ffa0', glow: '#22ffa0', fill: '#5dff3a', stroke: '#0a5a2a', rgb: [0.2, 1, 0.6],
    })),
  },
  // Mid-air steering (A/D, arrows): eased lateral acceleration, capped speed, drag when released. Near a lane
  // wall, steering toward it fades to nothing over `wallSlow` m (the ball keeps `wallMargin` m off the wall).
  steer: { accel: 28, maxSpeed: 9, drag: 2.5, wallMargin: 0.6, wallSlow: 4 },
  fullPowerAt: 0.9, // aim-meter power at and above this (PERFECT!) counts as full power: the ball's whole range (0.9 -> 1 maps to full)
  radius: 0.3, // m
  startForward: 0.7, // m in front of the player the ball leaves from
  startHeight: 0.5, // m above the feet
  // Landing debris: stud chunks thrown round the ball (ballKick -> kickFx); small next to the 0.3 m ball.
  crater: {
    debrisRadius: 0.5, // m from the ball to the first chunks
    chunks: 16, chunkSize: [0.1, 0.26], debrisSpread: 0.6,
    colors: ['#8fe02a', '#7bc61e', '#a8ee3c', '#6a4a2a'],
  },
  // Wins reel (HUD): rows scroll and lock onto the earned amount.
  winsReel: { spinSeconds: 2.23, rows: 18, volume: 0.6 }, // spinSeconds = length of audio/slot-machine-win.mp3
  camHoldAfterLand: 5, // s the camera keeps following the ball after it lands
  landHold: 0.8, // s the landed ball is shown (with its distance) before the ball resets; the camera eases back as soon as it lands
  viewPitch: 0.2, // kick view (as Stone-Skipping's throw view): radians above the horizon
  viewDistance: 10, // m behind the player
  viewYawOffset: Math.PI / 6, // rotation about Y from directly behind
  // BOUNCE! ring size.
  ringRadius: 3, // m
  ratings: [ // aim-meter power thresholds (0..1) -> banner text
    { min: 0.9, text: 'PERFECT!', tier: 'perfect' },
    { min: 0.65, text: 'GREAT!', tier: 'great' },
    { min: 0.35, text: 'GOOD!', tier: 'good' },
    { min: 0, text: 'OK', tier: 'ok' },
  ],
}

// Distance zones shown on the top bar while a kicked ball travels: laneLength is split evenly.
export const ZONES = [
  ['Common', '#3fae7a'], ['Rare', '#2f9e6c'], ['Epic', '#1f8f5c'], ['Legend', '#c9b26a'],
  ['Mythic', '#d8b45a'], ['Godly', '#e0533a'], ['Ancient', '#e4e4ea'], ['Divine', '#5ec04a'],
  ['Eternal', '#27b6d4'], ['Celestial', '#2f5fd0'], ['Secret', '#d048c0'],
]

// Look of each lane section, in ZONES order (arena.js). lawn/curb: flank strips; path: 8 m centre strip
// (null = the bare stud floor); wall/cap/capDark: cliff face, grass cap and drips; tuft/rock: lawn scatter;
// tree: topiary ('round'), pine ('pine') or alternating ('mix') in leaf/leafDark/trunk.
export const LANE_THEMES = [
  { lawn: '#a6ef22', curb: '#e0672f', path: null, wall: '#ee7543', cap: '#8ade2e', capDark: '#6ec522', tuft: ['#6ec522', '#8fe03c'], rock: ['#7d98dc', '#93acec'], tree: { kind: 'mix', leaf: '#8fe03c', leafDark: '#6cc92c', trunk: '#8a5a35' } },
  { lawn: '#52d68c', curb: '#1f9e6c', path: '#bfeed6', wall: '#2f9e8a', cap: '#3fc98a', capDark: '#2a9e6c', tuft: ['#2a9e6c', '#46d08c'], rock: ['#5fb7a8', '#8fd9c8'], tree: { kind: 'pine', leaf: '#3fc98a', leafDark: '#2a9e6c', trunk: '#6a4a30' } },
  { lawn: '#3fae6a', curb: '#14683e', path: '#a5d9c2', wall: '#1f7f78', cap: '#2f9e5a', capDark: '#1f7c46', tuft: ['#1f7c46', '#37b266'], rock: ['#4a8fb0', '#7fb8d0'], tree: { kind: 'round', leaf: '#37b266', leafDark: '#1f7c46', trunk: '#5a3e28' } },
  { lawn: '#ecd56e', curb: '#b8902a', path: '#fff0b0', wall: '#c9a24a', cap: '#f0cf55', capDark: '#c9a42e', tuft: ['#c9a42e', '#f6e07a'], rock: ['#d9b85a', '#f0d890'], tree: { kind: 'round', leaf: '#f2c94c', leafDark: '#d9a82e', trunk: '#8a6a35' } },
  { lawn: '#f5c24a', curb: '#a8741a', path: '#ffd98a', wall: '#a8741a', cap: '#ffb347', capDark: '#d98a1f', tuft: ['#d98a1f', '#ffc766'], rock: ['#c98a3a', '#e8b070'], tree: { kind: 'pine', leaf: '#ffb347', leafDark: '#e08a1f', trunk: '#6a4020' } },
  { lawn: '#d9482e', curb: '#7a1e12', path: '#ff8a2a', wall: '#8c2a1a', cap: '#e8582a', capDark: '#a8301a', tuft: ['#a8301a', '#ff7a30'], rock: ['#3a2a28', '#5a3a34'], tree: { kind: 'pine', leaf: '#b8321e', leafDark: '#7a1e12', trunk: '#2a1a16' } },
  { lawn: '#e8e8f0', curb: '#a8a8bc', path: '#f8f8ff', wall: '#cfcfd9', cap: '#f4f4fa', capDark: '#c4c4d4', tuft: ['#c4c4d4', '#f4f4fa'], rock: ['#b0b0c4', '#d4d4e2'], tree: { kind: 'pine', leaf: '#d4dae6', leafDark: '#aab4c8', trunk: '#8a8a9a' } },
  { lawn: '#6fe05a', curb: '#2f9a3a', path: '#c8f5b8', wall: '#3aa05a', cap: '#6fe05a', capDark: '#3fb04a', tuft: ['#3fb04a', '#8ff070'], rock: ['#7fd0a0', '#b0ecc8'], tree: { kind: 'round', leaf: '#ffb7d5', leafDark: '#f08ab8', trunk: '#8a5a45' } },
  { lawn: '#c4f4f8', curb: '#27b6d4', path: '#e8fcff', wall: '#6fd8e6', cap: '#e8fcff', capDark: '#a8e8f2', tuft: ['#a8e8f2', '#ffffff'], rock: ['#7fcfe0', '#b8eaf4'], tree: { kind: 'pine', leaf: '#e6fbff', leafDark: '#9fdcec', trunk: '#6a8a9a' } },
  { lawn: '#5c8cf0', curb: '#1d3fa8', path: '#9fbcff', wall: '#2a4fc0', cap: '#6a9aff', capDark: '#3a68d8', tuft: ['#3a68d8', '#8fb4ff'], rock: ['#2a3a90', '#5a6ac8'], tree: { kind: 'round', leaf: '#8fb4ff', leafDark: '#5a88f0', trunk: '#3a3a6a' } },
  { lawn: '#c46cf2', curb: '#7a2aa8', path: '#e0a8ff', wall: '#8a38c0', cap: '#d27af8', capDark: '#a848d8', tuft: ['#a848d8', '#f0a0ff'], rock: ['#5a2a8a', '#9a5ac8'], tree: { kind: 'mix', leaf: '#f05ad8', leafDark: '#b83ab8', trunk: '#3a1a5a' } },
]

export const ECONOMY = {
  capBase: 10, // kick power that fills the bar at level L: capBase + capPerLevel * L
  capPerLevel: 5,
  // Rebirth is a level gate: level needed for the current rebirth r (1-based) is
  // rebirthLevels[r - 1], then +rebirthLevelStep per rebirth past the table.
  rebirthLevels: [20, 40, 60, 80, 100, 125, 150],
  rebirthLevelStep: 25,
  multPerRebirth: 0.2, // permanent multiplier is 1 + multPerRebirth * rebirths (x1, x1.2, x1.4...)
  // Wins for a kick grow exponentially with distance: winsMax at laneLength metres.
  laneLength: LANE.length,
  winsMax: 50000,
  winsCurve: 8.1, // higher = flatter start, steeper finish (8.1: a Level 3 perfect kick, ~35 m, pays ~10; 550 m pays winsMax)
  autoClickInterval: 0.25, // s between automatic kicks (never faster than kickCooldown)
  padKickInterval: 2, // s between the automatic kicks while standing on a training pad
  kickCooldown: 0.35, // s a manual click/F/KICK! must wait after the last kick (anti spam-click); Auto Kick obeys it too
  freeSpinSeconds: 15 * 60, // s of continuous online play per free spin
  offlineSpinSeconds: 24 * 60 * 60, // s away from the game per free spin granted on return
  offlineSpinMax: 3, // most spins one return can grant
  invSlots: 2, // legends the inventory holds at the start
  invSlotCost: 1600000, // wins for the first extra slot; each further slot costs 2x more (1.6M, 3.2M, 6.4M...)
  // Lucky Wheel slices, clockwise from the pointer. `chance` is in percent and sums to 100.
  wheelPrizes: [
    { label: '+24K Wins', kind: 'wins', amount: 24000, chance: 17, color: '#35b6ff', icon: 'trophy' },
    { label: '+150 Kick', kind: 'kick', amount: 150, chance: 20, color: '#5fdc3a', icon: 'shoe' },
    { label: '+400K Wins', kind: 'wins', amount: 400000, chance: 2.5, color: '#a45cf0', icon: 'trophy' },
    { label: '+40 Kick', kind: 'kick', amount: 40, chance: 30.4, color: '#ffb73a', icon: 'shoe' },
    { label: '+120K Wins', kind: 'wins', amount: 120000, chance: 10, color: '#35b6ff', icon: 'trophy' },
    { label: 'RONALDU', kind: 'legend', id: 'ronaldu', chance: 0.1, color: '#5fdc3a', icon: 'legend' },
    { label: 'x2 Kick', kind: 'kick2x', chance: 8, color: '#a45cf0', icon: 'shoe' },
    { label: '+1 Spin', kind: 'spin', amount: 1, chance: 12, color: '#ffc83a', icon: 'spin' },
  ],
}

// Training goals, west to east. `rebirths` gates a field; `pass` fields show a pass banner.
export const TRAINING_FIELDS = [
  { name: 'x1 Kick', mult: 1, rebirths: 0, color: '#ff4a3d' },
  { name: 'x5 Kick', mult: 5, rebirths: 5, color: '#ff5fa8' },
  { name: 'x2 Kick', mult: 2, rebirths: 2, color: '#2f8cff' },
  { name: 'x8 Kick', mult: 8, rebirths: 10, color: '#23cfe6' },
  { name: 'x80 Kick', mult: 80, rebirths: 50, pass: 'ULTRA', color: '#4fe03a' },
  { name: 'x40 Kick', mult: 40, rebirths: 25, pass: 'VIP', color: '#ffd21f' },
]

// Footballs on the upgrade hill: rows of 6, 6 and 8 (front to back). `cost` is
// total wins needed to unlock; `kick` is kick power per click.
export const BALLS = [
  { cost: 0, kick: 1, color: '#f4f4f4', patch: '#1d1d22' },
  { cost: 8, kick: 2, color: '#34343c', patch: '#0d0d10' },
  { cost: 30, kick: 3, color: '#ead2a8', patch: '#5a3a1a' },
  { cost: 140, kick: 5, color: '#b0703c', patch: '#3a1e0a' },
  { cost: 500, kick: 7, color: '#d8323c', patch: '#3a0a0e' },
  { cost: 1300, kick: 10, color: '#ff5aa8', patch: '#4a0a2a' },
  { cost: 1600, kick: 11, color: '#ff8ad8', patch: '#5a1048' },
  { cost: 2000, kick: 12, color: '#e040e0', patch: '#3a0a3a' },
  { cost: 2500, kick: 13, color: '#f27ae6', patch: '#4a1042' },
  { cost: 3100, kick: 16, color: '#a24cf0', patch: '#2a0a4a' },
  { cost: 3900, kick: 18, color: '#3050e8', patch: '#0a1240' },
  { cost: 4900, kick: 21, color: '#2a6af0', patch: '#0a1a48' },
  { cost: 6400, kick: 23, color: '#3cc8f0', patch: '#0a3a4a' },
  { cost: 8500, kick: 26, color: '#2ad8e8', patch: '#08404a' },
  { cost: 11000, kick: 30, color: '#22c8c0', patch: '#063a36' },
  { cost: 15000, kick: 34, color: '#2bd04a', patch: '#0a3a12' },
  { cost: 19000, kick: 40, color: '#b8e030', patch: '#2a3a08' },
  { cost: 25000, kick: 44, color: '#f8e030', patch: '#3a3008' },
  { cost: 34000, kick: 49, color: '#ffc020', patch: '#3a2a06' },
  { cost: 44000, kick: 56, color: '#ff3030', patch: '#3a0606' },
  // Last entry: the Black Hole ball. Its kick is always 2x your best other ball (see ballKick in
  // stats.js); `kick` is only a floor. ~3.4x the last ball's cost since it doubles the best ball.
  { cost: 150000, kick: 2, color: '#07070c', patch: '#ff7a1a', blackHole: true },
]
export const BALL_ROWS = [6, 6, 8] // regular footballs only; the Black Hole ball sits after them in the front row

// Hemisphere fill + one shadow-casting sun that follows the player (world.js).
export const LIGHT = {
  sunColor: '#fff2d6',
  sunIntensity: 2.4,
  sunPosition: [14, 80, 20], // offset from the player (high sun: short shadows)
  shadowMapSize: 2048,
  shadowRange: 40, // half-width of the shadow frustum around the player
  hemiSky: '#ffffff',
  hemiGround: '#f2b98a', // warm bounce off the orange floor
  hemiIntensity: 1.9,
}

// Material presets (materials.js). Add new kinds here as props arrive.
export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
  PROP: { roughness: 0.8, metalness: 0 },
}

// Default (signed-out / fallback) character look.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#2f9e8f', hair: '#5a3a22' }

// Graphics presets, picked from the Bloxity `graphics_quality` setting.
export const GRAPHICS_PRESETS = {
  Low: { shadows: false, antialias: false, dpr: 1 },
  Medium: { shadows: true, antialias: false, dpr: 1.5 },
  High: { shadows: true, antialias: true, dpr: 2 },
  Ultra: { shadows: true, antialias: true, dpr: 2 },
}

// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  near: 0.1,
  far: 1200,
  startPitch: 0.42, // radians above the horizon
  minPitch: -0.1,
  maxPitch: 1.2,
  distance: 13, // resting boom length, m
  minDistance: 3,
  maxDistance: 22,
  followLerp: 10, // 1/s: the ONE smoothing stage, on the point the camera follows
  targetHeight: 0.6, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of look
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedDistance: 0.8, // m the boom pulls back at full speed
  speedFov: 4, // degrees the FOV widens at full speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 4, // 1/s the boom eases back out after a wall pulled it in
  // Ball cam (camera.js): follows the kicked ball down the lane from low behind it.
  ballCam: {
    enabled: true, // false = the old frozen kick view that only slides along Z
    distance: 5.5, // m behind the (smoothed) ball
    height: 1.6, // m above the ball
    lookRise: 1.1, // m the aim point sits above the ball, so the ball rides below screen centre
    lookAhead: 12, // m down the lane the aim point sits
    followXZ: 14, // 1/s horizontal follow; the lag also reads as a speed pull-back
    followY: 4, // 1/s vertical follow, slow so the horizon stays steady over the arc
    blendTime: 0.4, // s to ease from the player view to the ball cam
    fovBoost: 16, // degrees added at full speed
    fovSpeed: 60, // m/s that counts as full speed
    fovEase: 4, // 1/s the FOV eases in and out
    laneMargin: 1.2, // m the camera keeps from the lane walls
  },
}

// --- Bloxity (bloxity.js, avatar/) -------------------------------------------------
// SDK setting keys this game listens for; registering a listener makes the control
// appear in the portal's settings menu.
export const SETTINGS = {
  graphics_quality: { def: 'High', type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  fullscreen: { def: 'false', type: 'bool' },
}

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
// Bind-pose values of the rig nodes the SDK proportions drive.
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Juggle kick sequence (playerAvatar.js): release, right-foot hit, left-foot hit, catch.
// Training-pad ball loop: kick -> flies into the goal -> vanishes -> pops back in at the player's feet.
export const PAD_BALL = {
  flightTime: 0.4, // s from the foot to the goal
  respawnDelay: 0.12, // s the ball stays gone after reaching the goal
  popTime: 0.18, // s the new ball takes to pop in at the feet
  restZ: 1.9, // m (pad-local) where the ball waits, just ahead of the planted feet
  goalZ: -3.9, // m (pad-local) where the ball is swallowed by the goal
  arcHeight: 0.9, // m peak of the flight
}

export const JUGGLE = {
  gravity: 16, // m/s^2 on the ball (game-feel, stronger than real)
  holdY: 0.98, // m, ball height in the hands
  holdZ: 0.5, // m in front of the player
  kneeY: 0.5, // m, ball height where a foot meets it
  releaseDelay: 0.1, // s after click before the hands let go
  contactTime: 0.16, // s into a leg swing when the foot meets the ball (matches SWING in animator.js)
  swingDuration: 0.42,
  apex: [1.5, 1.8], // m peak height after the right / left foot hit
}

// Procedural animation (avatar/animator.js), ported from +1 Cut Grass Adventure.
// Rotations are radians in CHARACTER space: +X swings a limb backward, +Y yaws, +Z rolls.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-8), z: deg(14) },
      ArmL2: { x: deg(38) },
      ArmR1: { x: deg(4), z: deg(-6) },
      ArmR2: { x: deg(12) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(30) }, ArmR2: { x: deg(30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06 }, // s to blend a pose change
}

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true'
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}

// Legends: the equipped one multiplies wins from kicks. Costs are paid in wins and
// scale roughly with the multiplier (Chilli and Ronaldu extrapolated from the curve).
export const LEGENDS = [
  { id: 'chilli', name: 'Chillin Chilli', mult: 100, cost: 5e6, limited: true },
  { id: 'ronaldu', tier: 'Divine', name: 'Ronaldu', mult: 50, cost: 2e12 },
  { id: 'cancello', tier: 'Common', name: 'Cancello', mult: 1.5, cost: 0 },
  { id: 'pogbo', tier: 'Rare', name: 'Pogbo', mult: 2, cost: 5500 },
  { id: 'kvarra', tier: 'Rare', name: 'Kvarra', mult: 3, cost: 18000 },
  { id: 'neymer', tier: 'Epic', name: 'Neymer', mult: 5, cost: 95000 },
  { id: 'vinny', tier: 'Legendary', name: 'Vinny Jr', mult: 8, cost: 2.25e6 },
  { id: 'sallah', tier: 'Legendary', name: 'Sallah', mult: 12, cost: 6.5e6 },
  { id: 'yamol', tier: 'Divine', name: 'Yamol', mult: 20, cost: 20e6 },
  { id: 'beckhem', tier: 'Divine', name: 'Beckhem', mult: 30, cost: 1e9 },
  { id: 'kruyf', tier: 'Divine', name: 'Kruyf', mult: 40, cost: 100e9 },
  { id: 'debruyn', tier: 'Divine', name: 'De Bruyn', mult: 60, cost: 20e12 },
  { id: 'haalando', tier: 'Divine', name: 'Haalando', mult: 75, cost: 10e15 },
]

// --- New-player tutorial (tutorial.js, tutorialLogic.js) ------------------------------------------
// The step is saved with the account (stats.tutorialStep); an account saved before the tutorial existed counts as finished.
export const DISABLE_TUTORIAL = import.meta.env.VITE_DISABLE_TUTORIAL === 'true'
export const TUTORIAL = {
  steps: 13, // tutorialStep value meaning "finished" (backend constants.ts TUTORIAL_DONE_STEP must match)
  level2: 2, // step 0: click until Kick Power fills (15 at level 1) and this level is reached
  level3: 3, // step 2: train on the x1 goal up to this level
  level4: 4, // step 7: after buying the ball, train up to this level
  ball: 1, // the football the player is told to buy (+2 Kick)
  completeMs: 3500, // how long the "Tutorial Complete!" banner stays
}
