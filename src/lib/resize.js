/**
 * lib/resize.js
 * Adds a resize handle to the bottom-right corner of each widget.
 * Persists dimensions per widget under store key 'sizes'.
 *
 * Usage:
 *   initResize(widgetEl, 'pomodoro')
 */

import * as store from './store.js'

/** Minimum dimensions so widgets can't be collapsed to nothing */
const MIN_W = 180
const MIN_H = 120

/** Default sizes — matches CSS .widget-{id} widths, height is auto initially */
const DEFAULTS = {
  clock:    { w: 280,  h: null },
  pomodoro: { w: 256,  h: null },
  kanban:   { w: 620,  h: null },
  notes:    { w: 310,  h: null },
  goals:    { w: 290,  h: null },
  youtube:  { w: 310,  h: null },
  quotes:   { w: 480,  h: null },
}

function loadSizes() {
  return store.get('sizes') ?? {}
}

function saveSizes(sizes) {
  store.set('sizes', sizes)
}

/**
 * Apply saved size to a widget element.
 * Height null means let content determine height.
 */
export function applySavedSize(el, id) {
  const sizes   = loadSizes()
  const saved   = sizes[id] ?? DEFAULTS[id] ?? {}
  if (saved.w) el.style.width  = `${saved.w}px`
  if (saved.h) el.style.height = `${saved.h}px`
}

/**
 * Attach a resize handle to a widget.
 * @param {HTMLElement} el  - Widget root element
 * @param {string}      id  - Widget id for storage
 */
export function initResize(el, id) {
  // Apply any saved size first
  applySavedSize(el, id)

  // Create handle element
  const handle = document.createElement('div')
  handle.className = 'resize-handle'
  handle.title = 'Drag to resize'
  el.appendChild(handle)

  let resizing = false
  let startX, startY, startW, startH

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation() // prevent drag.js from firing

    resizing = true
    startX = e.clientX
    startY = e.clientY
    startW = el.offsetWidth
    startH = el.offsetHeight

    document.body.style.cursor = 'nwse-resize'
    document.body.style.userSelect = 'none'
  })

  window.addEventListener('mousemove', (e) => {
    if (!resizing) return

    const newW = Math.max(MIN_W, startW + (e.clientX - startX))
    const newH = Math.max(MIN_H, startH + (e.clientY - startY))

    el.style.width  = `${newW}px`
    el.style.height = `${newH}px`
  })

  window.addEventListener('mouseup', () => {
    if (!resizing) return
    resizing = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    // Persist
    const all = loadSizes()
    all[id]   = { w: el.offsetWidth, h: el.offsetHeight }
    saveSizes(all)
  })
}

/** Reset all sizes to defaults */
export function resetSizes() {
  saveSizes({})
}
