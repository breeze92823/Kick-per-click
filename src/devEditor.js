// Dev-only layout editor (VITE_DEV_MODE=true on the Vite dev server; main.js never loads this otherwise).
// Click a landmark (or pick it in the panel) to move / yaw / scale it with gizmos or numbers; Save posts the
// result to the dev server (vite.config.js), which writes src/devTransforms.json. landmarks.js and config.js
// read that file on every load, so saved edits also ship in production builds (the editor itself does not).
import { Raycaster, Vector2 } from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { inputState } from './input.js'

const ENDPOINT = '/__dev/save-transforms'
const round = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n
const poseOf = (g) => ({ x: round(g.position.x), y: round(g.position.y), z: round(g.position.z), rotY: round(g.rotation.y, 4), scale: round(g.scale.x) })
const same = (a, b) => ['x', 'y', 'z', 'rotY', 'scale'].every((k) => Math.abs(a[k] - b[k]) < 1e-3)

export function initDevEditor({ scene, camera, renderer, landmarks, teleportTo }) {
  const sites = new Map(landmarks.sites.map((s) => [s.key, s]))
  const saved = new Map([...sites].map(([k, s]) => [k, poseOf(s.group)])) // what is on disk right now
  const canvas = renderer.domElement
  let enabled = false
  let current = null
  let dirty = false

  const controls = new TransformControls(camera, canvas)
  controls.setSize(1.1)
  const helper = controls.getHelper()
  helper.visible = false
  scene.add(helper)

  const apply = (site, pose) => {
    const g = site.group
    g.position.set(pose.x, pose.y, pose.z)
    g.rotation.set(0, pose.rotY, 0)
    g.scale.setScalar(pose.scale)
    site.syncColliders()
  }

  // --- Panel ---------------------------------------------------------------------------------
  const css = document.createElement('style')
  css.textContent = `
    #dev-editor{position:fixed;left:12px;bottom:12px;z-index:99999;font:12px/1.4 system-ui,sans-serif;color:#eee;background:rgba(18,18,26,.92);border:1px solid #444;border-radius:8px;padding:8px 10px;width:230px;user-select:none}
    #dev-editor button,#dev-editor select,#dev-editor input{font:inherit;color:#eee;background:#2c2c3a;border:1px solid #555;border-radius:4px;padding:2px 6px}
    #dev-editor button{cursor:pointer}#dev-editor button.on{background:#3a6cff;border-color:#3a6cff}
    #dev-editor .row{display:flex;gap:4px;align-items:center;margin:4px 0}#dev-editor .row>*{flex:1;min-width:0}
    #dev-editor label{flex:0 0 38px;color:#aaa}#dev-editor input[type=number]{width:100%}
    #dev-editor .msg{color:#9f9;min-height:16px}#dev-editor .msg.err{color:#f88}
    #dev-toggle{position:fixed;left:12px;bottom:12px;z-index:99999;font:12px system-ui,sans-serif;color:#eee;background:rgba(18,18,26,.92);border:1px solid #444;border-radius:8px;padding:6px 10px;cursor:pointer}`
  document.head.append(css)

  const toggle = document.createElement('button')
  toggle.id = 'dev-toggle'
  toggle.textContent = 'Layout editor (` key)'
  const panel = document.createElement('div')
  panel.id = 'dev-editor'
  panel.hidden = true
  const fieldRows = [['x', 'x'], ['y', 'y'], ['z', 'z'], ['rot', 'yaw°'], ['scale', 'scale']]
    .map(([f, name]) => `<div class="row"><label>${name}</label><input type="number" step="${f === 'scale' ? 0.05 : f === 'rot' ? 5 : 0.25}" data-field="${f}"></div>`)
    .join('')
  panel.innerHTML = `
    <div class="row"><b>Layout editor</b><button data-act="close" style="flex:0 0 auto">x</button></div>
    <div class="row"><select data-id="site"><option value="">- pick a landmark -</option>${[...sites.keys()].map((k) => `<option value="${k}">${k}</option>`).join('')}</select><button data-act="goto" style="flex:0 0 auto">Go to</button></div>
    <div class="row"><button data-mode="translate">Move</button><button data-mode="rotate">Rotate</button><button data-mode="scale">Scale</button></div>
    <div class="row"><label style="flex:1"><input type="checkbox" data-id="snap" checked style="width:auto"> snap (keys 1 / 2 / 3 = mode)</label></div>
    ${fieldRows}
    <div class="row"><button data-act="reset">Reset</button><button data-act="revert">Revert all</button><button data-act="save">Save</button></div>
    <div class="msg" data-id="msg"></div>`
  document.body.append(toggle, panel)
  const $ = (sel) => panel.querySelector(sel)
  const fields = Object.fromEntries([...panel.querySelectorAll('[data-field]')].map((el) => [el.dataset.field, el]))
  const msg = (text, err = false) => {
    const el = $('[data-id=msg]')
    el.textContent = text
    el.classList.toggle('err', err)
  }
  for (const type of ['keydown', 'keyup']) panel.addEventListener(type, (e) => e.stopPropagation()) // typing must not walk the player

  function refreshFields() {
    const g = current?.group
    for (const el of Object.values(fields)) el.disabled = !g
    if (!g) return
    fields.x.value = round(g.position.x, 2)
    fields.y.value = round(g.position.y, 2)
    fields.z.value = round(g.position.z, 2)
    fields.rot.value = round((g.rotation.y * 180) / Math.PI, 1)
    fields.scale.value = round(g.scale.x, 2)
  }

  function setMode(mode) {
    controls.setMode(mode)
    // Colliders are yaw-only boxes, so rotation is Y only and scale is uniform (centre handle).
    controls.showX = controls.showZ = mode === 'translate'
    controls.showY = mode !== 'scale'
    for (const b of panel.querySelectorAll('[data-mode]')) b.classList.toggle('on', b.dataset.mode === mode)
  }

  function select(site) {
    current = site
    controls.detach()
    $('[data-id=site]').value = site?.key ?? ''
    if (site && enabled) controls.attach(site.group)
    refreshFields()
  }

  function setEnabled(on) {
    enabled = on
    panel.hidden = !on
    toggle.hidden = on
    helper.visible = on
    if (!on) controls.detach()
    else if (current) controls.attach(current.group)
  }

  // Keeps the group a pure yaw + uniform scale after a gizmo drag, then moves its colliders along.
  controls.addEventListener('objectChange', () => {
    const g = current.group
    const yaw = 2 * Math.atan2(g.quaternion.y, g.quaternion.w)
    g.rotation.set(0, yaw, 0)
    g.scale.setScalar(Math.min(10, Math.max(0.1, g.scale.x)))
    g.position.y = Math.max(0, g.position.y)
    current.syncColliders()
    dirty = true
    refreshFields()
  })

  const applySnap = () => {
    const on = $('[data-id=snap]').checked
    controls.setTranslationSnap(on ? 0.25 : null)
    controls.setRotationSnap(on ? Math.PI / 12 : null)
    controls.setScaleSnap(on ? 0.05 : null)
  }

  panel.addEventListener('input', (e) => {
    if (e.target.dataset.id === 'snap') return applySnap()
    if (!current || !e.target.dataset.field) return
    const v = parseFloat(e.target.value)
    if (!Number.isFinite(v)) return
    const pose = poseOf(current.group)
    const f = e.target.dataset.field
    if (f === 'rot') pose.rotY = (v * Math.PI) / 180
    else pose[f] = f === 'scale' ? Math.min(10, Math.max(0.1, v)) : v
    apply(current, pose)
    dirty = true
  })

  async function save() {
    const out = {}
    for (const [k, s] of sites) {
      const pose = poseOf(s.group)
      if (!same(pose, s.defaults)) out[k] = pose
    }
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(out) })
      if (!res.ok) throw new Error(await res.text())
      for (const [k, s] of sites) saved.set(k, poseOf(s.group))
      dirty = false
      msg(`Saved ${Object.keys(out).length} landmark(s) to src/devTransforms.json`)
    } catch (err) {
      msg(`Save failed: ${err.message}`, true)
    }
  }

  panel.addEventListener('click', (e) => {
    const t = e.target
    if (t.dataset.mode) setMode(t.dataset.mode)
    switch (t.dataset.act) {
      case 'close':
        return setEnabled(false)
      case 'save':
        return save()
      case 'goto': {
        if (!current) return
        const [x, z] = current.toWorld(0, 10)
        return teleportTo(x, current.group.position.y + 3, z)
      }
      case 'reset':
        if (current) {
          apply(current, saved.get(current.key))
          refreshFields()
        }
        return
      case 'revert':
        for (const [k, s] of sites) apply(s, saved.get(k))
        dirty = false
        refreshFields()
        return msg('Reverted to the last saved layout')
    }
  })
  $('[data-id=site]').addEventListener('change', (e) => select(sites.get(e.target.value) ?? null))
  toggle.addEventListener('click', () => setEnabled(true))

  // --- Picking -------------------------------------------------------------------------------
  const ray = new Raycaster()
  const ndc = new Vector2()
  const groups = [...sites.values()].map((s) => s.group)
  canvas.addEventListener('pointerdown', (e) => {
    if (!enabled || e.button !== 0 || controls.dragging || controls.axis) return // on the gizmo: let it drag
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObjects(groups, true)[0]
    let o = hit?.object
    while (o && !o.userData.siteKey) o = o.parent
    select(o ? sites.get(o.userData.siteKey) : null)
  })
  // Bubbles after input.js's own listener: a click while editing selects, it does not kick.
  window.addEventListener('pointerdown', (e) => {
    if (enabled && e.target === canvas) inputState.action = false
  })

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') setEnabled(!enabled)
    else if (enabled && e.code === 'Digit1') setMode('translate')
    else if (enabled && e.code === 'Digit2') setMode('rotate')
    else if (enabled && e.code === 'Digit3') setMode('scale')
  })
  window.addEventListener('beforeunload', (e) => {
    if (dirty) e.preventDefault() // unsaved layout edits
  })

  setMode('translate')
  applySnap()
  refreshFields()
}
