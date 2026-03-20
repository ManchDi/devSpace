/**
 * lib/bg-rotation.js
 * Wallpaper rotation — cycles through a pool of image/video files on a timer.
 *
 * Pool sources (mutually exclusive, last-set wins):
 *   - Directory   — all media files inside a picked folder
 *   - File list   — individually picked files
 *
 * Both are stored as FileSystemFileHandle[] in IndexedDB so they survive
 * browser restarts (subject to Chrome permission prompts after full close).
 *
 * State persisted in devstation_data → settings.rotation:
 *   {
 *     enabled:         boolean,
 *     intervalMinutes: number,   // 1 – 120
 *     order:           'sequential' | 'random',
 *     currentIndex:    number,
 *     sourceType:      'none' | 'directory' | 'files',
 *     sourceName:      string,   // display label only
 *   }
 *
 * Video FPS cap — a separate concern but lives here because it modifies the
 * same background pipeline. Stored in settings.videoBgFps (number, default 30).
 */

import * as store from './store.js'
import {
  saveRotationHandles,
  getRotationHandles,
  clearRotationHandles,
} from './fs-storage.js'

// ── Internal state ────────────────────────────────────────────────────────────

let _timer       = null     // setInterval handle
let _pool        = []       // FileSystemFileHandle[]  (current resolved pool)
let _applyFn     = null     // set by initRotation() — (buffer, type) => void
let _currentIdx  = -1

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSettings() {
  const s = store.get('settings') ?? {}
  return s.rotation ?? {
    enabled:         false,
    intervalMinutes: 10,
    order:           'sequential',
    currentIndex:    0,
    sourceType:      'none',
    sourceName:      '',
  }
}

function saveRotationSettings(patch) {
  const s   = store.get('settings') ?? {}
  const cur = s.rotation ?? {}
  store.set('settings', { ...s, rotation: { ...cur, ...patch } })
}

/** Read a FileSystemFileHandle and return { buffer, type } or null. */
async function readHandle(handle) {
  try {
    const perm = await handle.queryPermission({ mode: 'read' })
    if (perm !== 'granted') {
      const res = await handle.requestPermission({ mode: 'read' })
      if (res !== 'granted') return null
    }
    const file = await handle.getFile()
    return { buffer: await file.arrayBuffer(), type: file.type, name: file.name }
  } catch { return null }
}

function isMediaFile(name) {
  return /\.(jpe?g|png|webp|avif|gif|webm|mp4|mov)$/i.test(name)
}

/** Pick next index, advance _currentIdx, persist. */
function nextIndex(len) {
  const cfg = getSettings()
  if (cfg.order === 'random') {
    const next = Math.floor(Math.random() * len)
    _currentIdx = next
  } else {
    _currentIdx = (_currentIdx + 1) % len
  }
  saveRotationSettings({ currentIndex: _currentIdx })
  return _currentIdx
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function stopTimer() {
  if (_timer) { clearInterval(_timer); _timer = null }
}

async function applyNext() {
  if (!_pool.length || !_applyFn) return
  const idx    = nextIndex(_pool.length)
  const result = await readHandle(_pool[idx])
  if (result) _applyFn(result.buffer, result.type)
}

function startTimer(intervalMinutes) {
  stopTimer()
  if (!_pool.length) return
  _timer = setInterval(applyNext, intervalMinutes * 60 * 1000)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call once on app startup.
 * applyFn(buffer: ArrayBuffer, type: string) — should call the right
 * applyImageBuffer / applyVideoBuffer in background.js.
 */
export async function initRotation(applyFn) {
  _applyFn = applyFn

  // Restore pool from IDB
  const handles = await getRotationHandles()
  if (handles?.length) {
    _pool = handles
  }

  const cfg = getSettings()
  _currentIdx = cfg.currentIndex ?? 0

  if (cfg.enabled && _pool.length) {
    // Apply the current wallpaper immediately on startup so we restore
    // exactly where we left off instead of falling back to bgFile
    const handle = _pool[Math.min(_currentIdx, _pool.length - 1)]
    if (handle) {
      const result = await readHandle(handle)
      if (result) applyFn(result.buffer, result.type)
    }
    startTimer(cfg.intervalMinutes)
  }
}

/**
 * Open a directory picker — all media files inside become the pool.
 * Returns { sourceName, count } or null on cancel.
 */
export async function pickDirectory() {
  if (!('showDirectoryPicker' in window)) {
    alert('Directory picker not supported in this browser. Try Chrome or Edge.')
    return null
  }
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'read' })
    const handles   = []
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'file' && isMediaFile(name)) {
        handles.push(handle)
      }
    }
    if (!handles.length) {
      alert('No supported image/video files found in that folder.')
      return null
    }
    // Sort alphabetically for predictable sequential order
    handles.sort((a, b) => a.name.localeCompare(b.name))
    _pool = handles
    _currentIdx = -1
    await saveRotationHandles(handles)
    saveRotationSettings({ sourceType: 'directory', sourceName: dirHandle.name, currentIndex: 0 })
    return { sourceName: dirHandle.name, count: handles.length }
  } catch { return null }
}

/**
 * Open a multi-file picker — selected files become the pool.
 * Returns { sourceName, count } or null on cancel.
 */
export async function pickFiles() {
  if (!('showOpenFilePicker' in window)) return null
  try {
    const handles = await window.showOpenFilePicker({
      multiple: true,
      types: [{
        description: 'Images & Videos',
        accept: {
          'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'],
          'video/*': ['.webm', '.mp4', '.mov'],
        },
      }],
    })
    if (!handles.length) return null
    handles.sort((a, b) => a.name.localeCompare(b.name))
    _pool = handles
    _currentIdx = -1
    await saveRotationHandles(handles)
    const label = handles.length === 1
      ? handles[0].name
      : `${handles.length} files`
    saveRotationSettings({ sourceType: 'files', sourceName: label, currentIndex: 0 })
    return { sourceName: label, count: handles.length }
  } catch { return null }
}

/** Clear pool + stop timer. */
export async function clearRotationPool() {
  stopTimer()
  _pool = []
  _currentIdx = -1
  await clearRotationHandles()
  saveRotationSettings({ enabled: false, sourceType: 'none', sourceName: '', currentIndex: 0 })
}

/** Enable/disable rotation. Persists setting. */
export function setRotationEnabled(enabled) {
  saveRotationSettings({ enabled })
  if (enabled && _pool.length) {
    const cfg = getSettings()
    startTimer(cfg.intervalMinutes)
  } else {
    stopTimer()
  }
}

/** Update interval (minutes). Restarts timer if running. */
export function setRotationInterval(minutes) {
  saveRotationSettings({ intervalMinutes: minutes })
  const cfg = getSettings()
  if (cfg.enabled && _pool.length) startTimer(minutes)
}

/** Update order. */
export function setRotationOrder(order) {
  saveRotationSettings({ order })
}

/** Manually advance to next wallpaper (also resets the timer). */
export async function rotateNow() {
  await applyNext()
  const cfg = getSettings()
  if (cfg.enabled && _pool.length) startTimer(cfg.intervalMinutes) // reset interval
}

/** Returns current pool info for UI display. */
export function getPoolInfo() {
  const cfg = getSettings()
  return {
    count:      _pool.length,
    sourceType: cfg.sourceType ?? 'none',
    sourceName: cfg.sourceName ?? '',
    enabled:    cfg.enabled ?? false,
    intervalMinutes: cfg.intervalMinutes ?? 10,
    order:      cfg.order ?? 'sequential',
  }
}

// ── Video FPS cap ─────────────────────────────────────────────────────────────
// The actual frame-skipping lives in background.js (initBackground).
// These helpers just manage the stored setting.

export function getVideoBgFps() {
  const s = store.get('settings') ?? {}
  return s.videoBgFps ?? 30
}

export function setVideoBgFps(fps) {
  const s = store.get('settings') ?? {}
  store.set('settings', { ...s, videoBgFps: fps })
  // Notify background.js if it registered a setter
  window.__bgFns?.setVideoFps?.(fps)
}
