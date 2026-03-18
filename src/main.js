/**
 * main.js
 * Wires: animated background, widget registry, drag, settings, keyboard shortcuts.
 *
 * Background restore is two-phase:
 *   1. loadBackground()    — runs at startup, silently applies if permission already granted
 *   2. restoreBackground() — runs on first user click, requests permission if needed
 *
 * This is required because Chrome resets FileSystemFileHandle permissions after
 * full browser close, and requestPermission() only works inside a user gesture.
 */

import './styles/main.css'
import { initBackground, loadBackground, applyBackground, restoreBackground, applyBufferBackground, setVideoFps } from './background.js'
import { initDrag }    from './lib/drag.js'
import { initResize }  from './lib/resize.js'
import { initStorage } from './lib/store.js'
import { Settings }    from './settings/index.js'
import { WIDGETS }     from './widgets/registry.js'
import { initRotation, getVideoBgFps } from './lib/bg-rotation.js'

// ── Background phase 1 — silent restore (no gesture needed) ──────────────────
initBackground()
await loadBackground()
window.__bgFns = { applyBackground, setVideoFps }

// ── Storage init — load from disk before mounting widgets ─────────────────────
await initStorage()

// ── Init wallpaper rotation ───────────────────────────────────────────────────
await initRotation(applyBufferBackground)

// Apply stored FPS setting on startup
setVideoFps(getVideoBgFps())

// ── Storage init — load from disk before mounting widgets ─────────────────────
await initStorage()

// ── Mount widgets ─────────────────────────────────────────────────────────────
const app       = document.getElementById('app')
const instances = {}
const elements  = {}

for (const def of WIDGETS) {
  const instance = new def.Widget()
  const el       = instance.init()

  el.classList.add(`widget-${def.id}`)
  app.appendChild(el)

  instances[def.id] = instance
  elements[def.id]  = el

  const header = el.querySelector('.widget-header') ?? el
  initDrag(el, header, def.id)
  initResize(el, def.id)
}

// ── Settings ──────────────────────────────────────────────────────────────────
const settings = new Settings((widgetId, visible) => {
  const el = elements[widgetId]
  if (!el) return
  el.style.display = visible ? '' : 'none'
})

settings.init()

// ── Background phase 2 — restore on first click (inside user gesture) ─────────
// Chrome requires requestPermission() to be triggered by a user interaction.
// We listen for the first click anywhere on the page, attempt restore once,
// then remove the listener.
const onFirstClick = async () => {
  document.removeEventListener('click', onFirstClick)
  await restoreBackground()
}
document.addEventListener('click', onFirstClick)

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.code === 'Space') {
    e.preventDefault()
    instances.pomodoro?.handleKey(e)
    return
  }
  const tag = document.activeElement?.tagName
  if (e.key === 's' && !e.ctrlKey && !e.metaKey && tag !== 'INPUT' && tag !== 'TEXTAREA') {
    document.getElementById('settings-btn')?.click()
  }
})
