/**
 * lib/fs-storage.js
 * File System Access API — two responsibilities:
 *   1. Data save file  (key: 'saveFile') — readwrite
 *   2. Background file (key: 'bgFile')   — read only
 *
 * Both handles live in the same IndexedDB store so they
 * survive browser restarts.
 *
 * Permission notes:
 *   - Chrome resets handles to 'prompt' after full browser close
 *   - requestPermission() must be called inside a user gesture (click)
 *   - queryPermission() can be called any time (no gesture needed)
 *   - Background handle uses 'read' mode — no write needed
 *   - Save file handle uses 'readwrite' mode
 */

const IDB_DB    = 'devstation-fs'
const IDB_STORE = 'handles'

const SAVE_KEY     = 'saveFile'
const BG_KEY       = 'bgFile'
const ROTATION_KEY = 'rotationHandles'

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

async function getHandleByKey(key) {
  try {
    const db = await openIDB()
    return new Promise((resolve, reject) => {
      const req = db.transaction(IDB_STORE, 'readonly')
                   .objectStore(IDB_STORE).get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror   = () => reject(req.error)
    })
  } catch { return null }
}

async function putHandleByKey(key, handle) {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readwrite')
                 .objectStore(IDB_STORE).put(handle, key)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

async function deleteHandleByKey(key) {
  const db = await openIDB()
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(key)
    tx.oncomplete = () => resolve()
  })
}

// ── Permission helpers ────────────────────────────────────────────────────────

/**
 * Check + request readwrite permission for the data save file.
 * Must be called inside a user gesture if permission is 'prompt'.
 */
async function ensureReadWritePermission(handle) {
  if (!handle) return false
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' })
    if (perm === 'granted') return true
    return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted'
  } catch { return false }
}

/**
 * Silently check if read permission is already granted (no gesture needed).
 * Returns true only if already 'granted' — does NOT prompt.
 */
export async function checkBgPermissionSilent() {
  const handle = await getHandleByKey(BG_KEY)
  if (!handle) return false
  try {
    const perm = await handle.queryPermission({ mode: 'read' })
    return perm === 'granted'
  } catch { return false }
}

/**
 * Request read permission for the bg handle.
 * MUST be called inside a user gesture (click).
 * Returns { buffer, type, name } or null.
 */
export async function requestBgPermissionAndRead() {
  const handle = await getHandleByKey(BG_KEY)
  if (!handle) return null
  try {
    const current = await handle.queryPermission({ mode: 'read' })
    if (current !== 'granted') {
      const result = await handle.requestPermission({ mode: 'read' })
      if (result !== 'granted') return null
    }
    const file = await handle.getFile()
    return { buffer: await file.arrayBuffer(), type: file.type, name: file.name }
  } catch { return null }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const isSupported = () =>
  typeof window !== 'undefined' && 'showSaveFilePicker' in window

// ── Data save file ────────────────────────────────────────────────────────────

export async function pickSaveFile() {
  if (!isSupported()) return null
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'devstation-data.json',
      types: [{ description: 'DevStation Data', accept: { 'application/json': ['.json'] } }],
    })
    await putHandleByKey(SAVE_KEY, handle)
    return handle
  } catch { return null }
}

export async function openExistingFile() {
  if (!isSupported()) return null
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'DevStation Data', accept: { 'application/json': ['.json'] } }],
      multiple: false,
    })
    const ok = await handle.requestPermission({ mode: 'readwrite' })
    if (ok !== 'granted') return null
    await putHandleByKey(SAVE_KEY, handle)
    const file = await handle.getFile()
    return { handle, data: JSON.parse(await file.text()) }
  } catch { return null }
}

export async function hasSaveFile() {
  return !!(await getHandleByKey(SAVE_KEY))
}

export async function getSaveFileName() {
  return (await getHandleByKey(SAVE_KEY))?.name ?? null
}

export async function writeToDisk(data) {
  if (!isSupported()) return
  const handle = await getHandleByKey(SAVE_KEY)
  if (!handle) return
  const ok = await ensureReadWritePermission(handle)
  if (!ok) return
  try {
    const writable = await handle.createWritable()
    await writable.write(JSON.stringify(data, null, 2))
    await writable.close()
  } catch (e) { console.warn('[fs-storage] write failed', e) }
}

export async function readFromDisk() {
  if (!isSupported()) return null
  const handle = await getHandleByKey(SAVE_KEY)
  if (!handle) return null
  const ok = await ensureReadWritePermission(handle)
  if (!ok) return null
  try {
    const file = await handle.getFile()
    return JSON.parse(await file.text())
  } catch (e) { console.warn('[fs-storage] read failed', e); return null }
}

export async function unlinkSaveFile() {
  await deleteHandleByKey(SAVE_KEY)
}

// ── Background file handle ────────────────────────────────────────────────────

export async function saveBgHandle(handle) {
  await putHandleByKey(BG_KEY, handle)
}

export async function clearBgHandle() {
  await deleteHandleByKey(BG_KEY)
}

export async function hasBgFile() {
  return !!(await getHandleByKey(BG_KEY))
}

export async function getBgFileName() {
  return (await getHandleByKey(BG_KEY))?.name ?? null
}

// ── Rotation file handles ─────────────────────────────────────────────────────
// Stored as an array under a single IDB key.

export async function saveRotationHandles(handles) {
  await putHandleByKey(ROTATION_KEY, { handles })
}

export async function getRotationHandles() {
  const rec = await getHandleByKey(ROTATION_KEY)
  return rec?.handles ?? null
}

export async function clearRotationHandles() {
  await deleteHandleByKey(ROTATION_KEY)
}
