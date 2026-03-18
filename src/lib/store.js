/**
 * lib/store.js
 * Central data layer. All widgets read/write through here.
 *
 * Architecture:
 *   - localStorage is the synchronous source of truth (instant reads/writes)
 *   - Every write is also shadowed to disk via fs-storage.js (async, fire-and-forget)
 *   - On startup, initStorage() loads from disk and seeds localStorage if a file exists
 *
 * Widgets never need to change — they call get/set synchronously as before.
 */

import { writeToDisk, readFromDisk, hasSaveFile } from './fs-storage.js'

const LS_KEY = 'devstation_data'

// Debounce disk writes so rapid successive saves don't hammer the file system
let _writeTimer = null
function scheduleDiskWrite() {
  clearTimeout(_writeTimer)
  _writeTimer = setTimeout(() => {
    writeToDisk(loadAll())
  }, 600)
}

// ── Raw localStorage helpers ──────────────────────────────────────────────────

function loadAll() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveAll(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('[store] localStorage write failed', e)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Get a namespace slice (e.g. store.get('kanban')) */
export function get(namespace) {
  return loadAll()[namespace] ?? null
}

/** Set a namespace slice, persist to localStorage + schedule disk write */
export function set(namespace, value) {
  const all = loadAll()
  all[namespace] = value
  saveAll(all)
  scheduleDiskWrite()
}

/** Wipe localStorage (disk file is NOT deleted — it's a fallback) */
export function clear() {
  localStorage.removeItem(LS_KEY)
}

/** Export full snapshot as JSON string */
export function exportJSON() {
  return localStorage.getItem(LS_KEY) ?? '{}'
}

// ── Startup: seed localStorage from disk if a file is configured ──────────────

/**
 * Call this once at app startup (await it before mounting widgets).
 * If a save file exists and has data, it wins over localStorage.
 * This makes the file the canonical source of truth across browsers/clears.
 */
export async function initStorage() {
  const fileConfigured = await hasSaveFile()
  if (!fileConfigured) return

  const diskData = await readFromDisk()
  if (!diskData || Object.keys(diskData).length === 0) {
    // File exists but is empty — push current localStorage to it
    const current = loadAll()
    if (Object.keys(current).length > 0) {
      await writeToDisk(current)
    }
    return
  }

  // File has data — use it as source of truth (overwrites localStorage)
  saveAll(diskData)
}
