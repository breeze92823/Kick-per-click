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

  // Box centred at (x, y, z), yawed by rotY. BoxGeometry faces: +x, -x, +y, -y, +z, -z.
  function box(material, x, y, z, w, h, d, color, rotY = 0) {
    const g = new BoxGeometry(w, h, d)
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
    g.applyMatrix4(m.compose(p.set(x, y, z), q.setFromEuler(e.set(0, rotY, 0)), one))
    if (!byMaterial.has(material)) byMaterial.set(material, [])
    byMaterial.get(material).push(g)
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

  return { box, build }
}
