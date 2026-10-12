// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'kick-per-click' // slug registered on bloxity.io
export const GAME_TITLE = 'Kick per Click'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
export const GROUND_Y = 0
export const GROUND_SIZE = 440 // square stud-plate ground, centred on the origin
export const WORLD_BOUNDS = { minX: -215, maxX: 215, minZ: -215, maxZ: 215 } // invisible backstop inside the ground edge
export const SPAWN = { x: 0, y: 0.6, z: 0 } // on top of the football spawn pad
export const SPAWN_FACING = 0 // yaw the character faces on spawn (0 = toward +Z: landmarks, then the kick lane)

// --- Map layout (arena.js, landmarks.js) ---------------------------------------
// The play area is a walled arena; the long kick lane runs south out of it.
export const ARENA = {
  minX: -46,
  maxX: 46,
  minZ: -46,
  maxZ: 40,
  wallThickness: 6, // m per cliff ring (two rings, the outer one taller)
  wallHeight: { min: 18, max: 28 },
  column: 4, // m per cliff column along a wall
  lane: { minX: -12, maxX: 12, endZ: 200, drop: 3, wallHeight: { min: 12, max: 18 } },
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
export const FOG = { near: 140, far: 420 }

// Sky dome (world.js): gradient, two rainbows, procedural clouds, sun disc.
export const SKY = { radius: 900, cloudScale: 1.3, cloudCover: 0.5 }

// Font for the HUD and all in-world labels (Google Fonts link in index.html).
export const UI_FONT = '"Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif'

// --- Controls ------------------------------------------------------------------
// Same as Clean-leaves-for-loot: first key/click captures the mouse (mouse-look); Esc frees it; right-drag orbits where lock is refused.
export const CONTROLS = { pointerLock: true }

// --- Economy (stats.js) --------------------------------------------------------
// The kicked ball (ballKick.js): a gravity arc down the lane that lands and stops (no bounce).
export const KICKBALL = {
  gravity: 30, // m/s^2
  angle: 30, // degrees above the horizon (flat enough to stay in the frozen follow-cam view)
  baseSpeed: 20, // m/s launch speed before upgrades
  speedPerDecade: 9, // m/s per decade (log10) of equippedBall.kick * level
  speedPerRebirth: 3, // m/s per rebirth after the first
  maxSpeed: 80, // m/s (about 190 m of range; the lane ends first)
  radius: 0.3, // m
  startForward: 0.7, // m in front of the player the ball leaves from
  startHeight: 0.5, // m above the feet
  landHold: 0.8, // s the landed ball is shown (with its distance) before the ball resets; the camera eases back as soon as it lands
  viewPitch: 0.2, // kick view (as Stone-Skipping's throw view): radians above the horizon
  viewDistance: 10, // m behind the player
  viewYawOffset: Math.PI / 6, // rotation about Y from directly behind
}

export const ECONOMY = {
  capBase: 10, // kick power that fills the bar at level L: capBase + capPerLevel * L
  capPerLevel: 5,
  // Rebirth is a level gate: level needed for the current rebirth r (1-based) is
  // rebirthLevels[r - 1], then +rebirthLevelStep per rebirth past the table.
  rebirthLevels: [20, 40, 60, 80, 100, 125, 150],
  rebirthLevelStep: 25,
  multPerRebirth: 1, // permanent multiplier is 1 + multPerRebirth * rebirths (x1, x2, x3...), like Stone-Skipping
  // Wins for a kick grow exponentially with distance: winsMax at laneLength metres.
  laneLength: 150,
  winsMax: 300,
  winsCurve: 5, // higher = flatter start, steeper finish
  autoClickInterval: 0.25, // s between automatic kicks
  freeSpinSeconds: 15 * 60,
}

// Training goals, west to east. `rebirths` gates a field; `pass` fields show a pass banner.
export const TRAINING_FIELDS = [
  { name: 'x1 Kick', mult: 1, rebirths: 0, color: '#ff4a3d' },
  { name: 'x5 Kick', mult: 5, rebirths: 5, color: '#ff5fa8' },
  { name: 'x2 Kick', mult: 2, rebirths: 2, color: '#2f8cff' },
  { name: 'x8 Kick', mult: 8, rebirths: 10, color: '#23cfe6' },
  { name: 'x80 Kick', mult: 80, rebirths: 0, pass: 'ULTRA', color: '#4fe03a' },
  { name: 'x40 Kick', mult: 40, rebirths: 0, pass: 'VIP', color: '#ffd21f' },
]

// Footballs on the upgrade hill: rows of 6, 6 and 8 (front to back). `cost` is
// total wins needed to unlock; `kick` is kick power per click.
export const BALLS = [
  { cost: 0, kick: 1, color: '#f4f4f4', patch: '#1d1d22' },
  { cost: 10, kick: 2, color: '#34343c', patch: '#0d0d10' },
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
]
export const BALL_ROWS = [6, 6, 8]
export const BLACK_HOLE_BALL = { price: 349 }

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
