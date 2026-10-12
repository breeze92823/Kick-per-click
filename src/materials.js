// Material factory: one place that turns config presets + procedural textures into
// three materials. Cached by key so props share them (and share GPU state).
import { Color, DoubleSide, MeshStandardMaterial } from 'three'
import { FLOOR_TILE_M, ballTexture, cached, checkerTexture, netTexture, paintFloor, studTexture, toTexture } from './textures.js'
import { GROUND_SIZE, MATERIAL_PBR } from './config.js'

// Plain coloured standard material from a MATERIAL_PBR preset ('PLAYER' | 'GROUND' | 'PROP').
export function solid(color, kind = 'PROP', extra = {}) {
  return cached(`solid${color}${kind}${JSON.stringify(extra)}`, () => new MeshStandardMaterial({ color: new Color(color), ...MATERIAL_PBR[kind], ...extra }))
}

// Checker-textured material, for blocky props.
export function checker(colA, colB, { cells = 2, tiles = 1, kind = 'PROP' } = {}) {
  return cached(`checkerMat${colA}${colB}${cells}${tiles}${kind}`, () => {
    const map = checkerTexture(colA, colB, cells).clone()
    map.repeat.set(tiles, tiles)
    map.needsUpdate = true
    return new MeshStandardMaterial({ map, ...MATERIAL_PBR[kind] })
  })
}

// Stud plastic tinted per vertex: every merged voxel prop (voxels.js) uses this.
export function studMaterial() {
  return cached('studMat', () => new MeshStandardMaterial({ map: studTexture(), vertexColors: true, ...MATERIAL_PBR.PROP }))
}

// Goal nets: see-through cords, tinted per vertex.
export function netMaterial() {
  return cached('netMat', () => new MeshStandardMaterial({ map: netTexture(), vertexColors: true, alphaTest: 0.5, side: DoubleSide, ...MATERIAL_PBR.PROP }))
}

export function ballMaterial(base, patch) {
  return cached(`ballMat${base}${patch}`, () => new MeshStandardMaterial({ map: ballTexture(base, patch), roughness: 0.45, metalness: 0 }))
}

// The arena floor: orange stud plates tiled across the whole ground plane.
export function groundMaterial() {
  return cached('groundMat', () => new MeshStandardMaterial({ map: toTexture(paintFloor(), { tiles: GROUND_SIZE / FLOOR_TILE_M }), ...MATERIAL_PBR.GROUND }))
}
