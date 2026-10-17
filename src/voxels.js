// Static voxel scenery as merged boxes: every box added here ends up in one mesh
// per material, so the whole blocky map costs a handful of draw calls. UVs are in
// metres, so the stud texture keeps its size on any box.
import { BoxGeometry, BufferAttribute, Color, Euler, Matrix4, Mesh, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createVoxelBuilder() {
  const byMaterial = new Map()
  const m = new Matrix4()
  const q = new Quaternion()
  const e = new Euler()
  const p = new Vector3()
  const one = new Vector3(1, 1, 1)
  const col = new Color()

  // Metre UVs and a flat vertex colour on a unit-less BoxGeometry(w, h, d), then queued under `material`.
  function push(material, g, w, h, d, color) {
    const uv = g.attributes.uv
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
    for (let f = 0; f < 6; f++) {
      for (let i = 0; i < 4; i++) {
        const k = f * 4 + i
        uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1])
      }
    }
    col.set(color)
    const n = g.attributes.position.count
    const c = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      c[i * 3] = col.r
      c[i * 3 + 1] = col.g
      c[i * 3 + 2] = col.b
    }
    g.setAttribute('color', new BufferAttribute(c, 3))
    if (!byMaterial.has(material)) byMaterial.set(material, [])
    byMaterial.get(material).push(g)
  }

  // Box centred at (x, y, z), yawed by rotY. BoxGeometry faces: +x, -x, +y, -y, +z, -z.
  function box(material, x, y, z, w, h, d, color, rotY = 0) {
    const g = new BoxGeometry(w, h, d)
    g.applyMatrix4(m.compose(p.set(x, y, z), q.setFromEuler(e.set(0, rotY, 0)), one))
    push(material, g, w, h, d, color)
  }

  // A box running from point A to point B (any direction): its length is |AB|, `w` x `d` the cross-section.
  // `across` hints which way the width points (default: sideways); it is made perpendicular to the beam.
  // Used for leaning trunks, leaves, blades of grass: things plain yaw-only boxes cannot express.
  const ax = new Vector3()
  const ay = new Vector3()
  const az = new Vector3()
  const mid = new Vector3()
  function beam(material, x0, y0, z0, x1, y1, z1, w, d, color, ahx = 1, ahy = 0, ahz = 0) {
    ay.set(x1 - x0, y1 - y0, z1 - z0)
    const len = ay.length()
    if (len < 1e-4) return
    ay.divideScalar(len)
    ax.set(ahx, ahy, ahz)
    ax.addScaledVector(ay, -ax.dot(ay))
    if (ax.lengthSq() < 1e-6) {
      ax.set(0, 0, 1)
      ax.addScaledVector(ay, -ax.dot(ay))
    }
    ax.normalize()
    az.crossVectors(ax, ay)
    mid.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    const g = new BoxGeometry(w, len, d)
    g.applyMatrix4(m.makeBasis(ax, ay, az).setPosition(mid))
    push(material, g, w, len, d, color)
  }

  function build(parent) {
    for (const [material, list] of byMaterial) {
      const mesh = new Mesh(mergeGeometries(list), material)
      for (const g of list) g.dispose()
      mesh.castShadow = true
      mesh.receiveShadow = true
      parent.add(mesh)
    }
    byMaterial.clear()
  }

  return { box, beam, build }
}
