# Kick per Click

Three.js (vanilla) + Vite. Roblox-style clicker: walled stud arena, landmarks, HUD, kick/level/wins progression, Bloxity integration. Ported from `C:\ThreeJS\Clean-leaves-for-loot\Clean-leaves-for-loot`.

- `npm run dev` / `npm run build`. `VITE_DEV_MODE=true` (see `.env.example`) skips the Bloxity SDK/CDN.
- All tunables are in `src/config.js`. All Bloxity SDK calls go through `src/bloxity.js` and must never throw (SDK may be blocked).
- `src/player.js`: player singleton + kinematic movement (accel/decel, gravity, coyote time, jump buffer, step-up). `floorAt` is the single floor lookup, backed by `src/colliders.js` (yaw-rotated boxes; call `addCollider`; tops within `PHYSICS.stepUp` are walkable).
- `src/camera.js`: chase cam (own yaw/pitch, eased zoom, speed pull-back/FOV, pulls in against `segmentClear`). `src/input.js`: WASD/arrows, Space, mouse look (pointer lock), wheel zoom, F/click = `inputState.action`, E = `interact`.
- `src/textures.js` canvas painters (`studTexture`, `paintFloor`, `ballTexture`/`soccerPanel`, `netTexture`, `wheelTexture`, `toTexture`, `shade`); `src/materials.js` cached material factory (`solid`, `studMaterial`, `netMaterial`, `ballMaterial`, `groundMaterial`) using `MATERIAL_PBR` presets.
- `src/world.js`: stud floor, sky shader (gradient, rainbows, clouds, sun; follows the camera), fog, hemisphere + shadow-casting sun that follows the player (texel-snapped).
- `src/voxels.js`: merged box builder (one mesh per material, metre UVs, vertex colours). `src/arena.js`: cliff walls, kick lane, lawns, spawn pad, trees. `src/landmarks.js`: training goals, wheel, sign, chest, leaderboards, NPCs, upgrade hill, Beach World portal, walk-up prompts (E). Layout lives in `SITES`/`LAWNS`/`ARENA` in config.
- `src/labels.js`: outlined billboard text sprites (`makeLabel`, `paintText`), repainted when the Fredoka web font loads.
- `src/stats.js`: progression state (kick power, level, wins, rebirths, balls), localStorage save, `onStats` events. `src/hud.js` + `hud.css`: DOM HUD on a 1920x991 reference grid (`--k`). Cursor stays free (`CONTROLS.pointerLock = false`): world click / F / KICK! = one kick.
- `src/playerAvatar.js` + `src/avatar/`: Bloxity base rig (`public/avatars/player.glb`) or procedural fallback, equipped cosmetics, proportions, procedural idle/run/airborne/landing animator.
- Multiplayer/saves: `src/net.js` talks to `../Kick-per-click-backend` (Colyseus room `world`; `VITE_SERVER_URL_DEV`/`_MAIN` per channel, `npm run dev` defaults to `ws://localhost:2567`; empty = `SDK.net.resolveEndpoint(GAME_SLUG)`; neither = offline). It loads the saved doc into `stats` (`hydrateStats`), debounce-saves the `SAVED` keys (never for guests), relays pose/avatar/ball/legend and feeds the hub leaderboards (`landmarks.js` BOARDS). `src/remotePlayers.js` draws the other players from `room.state.players`. Ball/legend ids and `WORLD_BOUNDS` in the backend's `constants.ts` must match `config.js`.
- CI/CD: `.github/workflows/deploy.yml` builds on PRs and pushes to `main`/`dev`; pushes also upload `dist` to Bloxity hosting (`main` = prod, `dev` = dev channel). Needs repo var/secret `LEGION_GAME_ID` and secret `LEGION_DEPLOY_TOKEN`; optional `SERVER_URL_DEV`/`SERVER_URL_MAIN`. The backend repo has its own workflow.
- `src/main.js`: renderer, graphics presets (`graphics_quality` setting), loop. Dev console: `__game.teleport(x, y, z)`.

## Reference docs (consult only when needed)

- Bloxity docs (SDK/platform): https://docs.bloxity.io/
- Bloxity hosting docs: https://hosting.bloxity.io/docs
