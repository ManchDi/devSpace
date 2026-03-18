/**
 * lib/drag.js
 * Makes any element draggable by a handle element.
 * Loads/saves position from store under namespace 'positions'.
 *
 * Usage:
 *   initDrag(widgetEl, headerEl, 'pomodoro')
 */

import * as store from './store.js'

/** Default positions for first load — approximate a nice layout */
const DEFAULTS = {
  clock:    { x: 16,  y: 16  },
  pomodoro: { x: 16,  y: 160 },
  kanban:   { x: 294, y: 16  },
  notes:    { x: 294, y: 430 },
  goals:    { x: 938, y: 16  },
  youtube:  { x: 938, y: 360 },
  quotes:   { x: 16,  y: 520 },
}

function loadPositions() {
  return store.get('positions') ?? {}
}

function savePositions(positions) {
  store.set('positions', positions)
}

/**
 * Apply a clamped position to the widget element.
 * Keeps the widget header always within the viewport.
 */
function applyPosition(el, x, y) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w  = el.offsetWidth  || 260
  const h  = 44               // minimum drag handle height

  const cx = Math.max(0, Math.min(x, vw - w))
  const cy = Math.max(0, Math.min(y, vh - h))

  el.style.left = `${cx}px`
  el.style.top  = `${cy}px`

  return { x: cx, y: cy }
}

/**
 * Initialise drag on a widget.
 * @param {HTMLElement} el       - The widget root element
 * @param {HTMLElement} handleEl - The drag handle (widget header)
 * @param {string}      id       - Widget id (for position storage)
 */
export function initDrag(el, handleEl, id) {
  // Load or fall back to default position
  const positions = loadPositions()
  const pos       = positions[id] ?? DEFAULTS[id] ?? { x: 40, y: 40 }

  el.style.position = 'absolute'
  el.style.zIndex   = '10'
  applyPosition(el, pos.x, pos.y)

  handleEl.style.cursor = 'grab'

  let dragging = false
  let startX, startY, origX, origY

  const onMouseDown = (e) => {
    // Ignore clicks on buttons/inputs inside header
    if (e.target.closest('button, input, select, textarea')) return

    dragging = true
    startX   = e.clientX
    startY   = e.clientY
    origX    = el.offsetLeft
    origY    = el.offsetTop

    handleEl.style.cursor = 'grabbing'
    el.style.zIndex       = '20'
    el.style.transition   = 'none'

    e.preventDefault()
  }

  const onMouseMove = (e) => {
    if (!dragging) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    applyPosition(el, origX + dx, origY + dy)
  }

  const onMouseUp = () => {
    if (!dragging) return
    dragging = false
    handleEl.style.cursor = 'grab'
    el.style.zIndex       = '10'

    // Persist
    const all   = loadPositions()
    all[id]     = { x: el.offsetLeft, y: el.offsetTop }
    savePositions(all)
  }

  handleEl.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove',   onMouseMove)
  window.addEventListener('mouseup',     onMouseUp)

  // Bring widget to front on any click
  el.addEventListener('mousedown', () => {
    document.querySelectorAll('.widget').forEach(w => w.style.zIndex = '10')
    el.style.zIndex = '15'
  })

  // Re-clamp on window resize
  window.addEventListener('resize', () => {
    const p = loadPositions()
    if (p[id]) applyPosition(el, p[id].x, p[id].y)
  })
}

/** Reset all widget positions to defaults */
export function resetPositions() {
  savePositions(DEFAULTS)
  location.reload()
}
