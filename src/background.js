/**
 * background.js
 * Three layers:
 *   1. #bg-image  — still image background
 *   2. #bg-video  — video background (autoplay loop muted)
 *   3. #bg-canvas — animated blob overlay
 *
 * Background file (image OR video) is stored via a FileSystemFileHandle
 * in IndexedDB — no base64, no size limit, persists across sessions.
 *
 * Startup flow (two-phase because of Chrome's user gesture requirement):
 *
 *   Phase 1 — loadBackground() — called automatically on startup
 *     Checks if permission is ALREADY granted (silent, no gesture needed).
 *     If yes: reads file + applies bg immediately.
 *     If no:  shows a faint "Click to restore background" prompt.
 *
 *   Phase 2 — restoreBackground() — called on first user click (main.js)
 *     Calls requestPermission() which IS inside a user gesture.
 *     Reads file + applies bg. Prompt disappears.
 *
 * This two-phase approach is required because Chrome resets file handle
 * permissions to 'prompt' after the browser is fully closed, and
 * requestPermission() is blocked unless triggered by a click.
 *
 * Performance notes:
 *   - Canvas draw loop skips clearRect + blobs entirely when opacity === 0
 *   - rAF loop pauses when tab is hidden (visibilitychange)
 *   - Widget blur/opacity tunable via Widget Glass slider in settings
 */

import {
  saveBgHandle,
  clearBgHandle,
  hasBgFile,
  checkBgPermissionSilent,
  requestBgPermissionAndRead,
} from './lib/fs-storage.js'

const BLOBS = [
  { r: 200, g: 120, b: 80,  size: 0.45, speed: 0.00018, phase: 0.00 },
  { r: 60,  g: 90,  b: 180, size: 0.38, speed: 0.00013, phase: 2.10 },
  { r: 80,  g: 160, b: 120, size: 0.32, speed: 0.00021, phase: 4.20 },
  { r: 140, g: 60,  b: 180, size: 0.28, speed: 0.00016, phase: 1.05 },
]

const OPACITY_WITH_BG    = 0.0
const OPACITY_WITHOUT_BG = 0.045

// ── Canvas blob animation ─────────────────────────────────────────────────────

export function initBackground() {
  const canvas = document.getElementById('bg-canvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  let w = 0, h = 0, t = 0, animId = null
  let opacity = OPACITY_WITHOUT_BG

  function resize() {
    w = canvas.width  = window.innerWidth
    h = canvas.height = window.innerHeight
  }

  function draw() {
    if (opacity > 0) {
      ctx.clearRect(0, 0, w, h)
      for (const blob of BLOBS) {
        const cx     = w * (0.5 + 0.4 * Math.sin(t * blob.speed + blob.phase))
        const cy     = h * (0.5 + 0.35 * Math.cos(t * blob.speed * 0.7 + blob.phase + 1))
        const radius = Math.min(w, h) * blob.size
        const grad   = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        grad.addColorStop(0,   `rgba(${blob.r},${blob.g},${blob.b},${opacity})`)
        grad.addColorStop(0.5, `rgba(${blob.r},${blob.g},${blob.b},${opacity * 0.4})`)
        grad.addColorStop(1,   `rgba(${blob.r},${blob.g},${blob.b},0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    t++
    animId = requestAnimationFrame(draw)
  }

  canvas._setOpacity = (val) => { opacity = val }

  window.addEventListener('resize', resize)
  resize()
  draw()

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animId)
    } else {
      draw()
    }
  })

  return () => {
    cancelAnimationFrame(animId)
    window.removeEventListener('resize', resize)
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function setCanvasOpacity(hasBackground) {
  const canvas = document.getElementById('bg-canvas')
  if (canvas?._setOpacity) {
    canvas._setOpacity(hasBackground ? OPACITY_WITH_BG : OPACITY_WITHOUT_BG)
  }
}

function hideAll() {
  const img = document.getElementById('bg-image')
  const vid = document.getElementById('bg-video')
  const vc  = document.getElementById('bg-video-canvas')
  if (img) img.style.opacity = '0'
  if (vid) { vid.style.opacity = '0'; vid.src = '' }
  if (vc)  vc.style.opacity  = '0'
  stopVideoLoop()
}

function applyImageBuffer(buffer, type) {
  const url = URL.createObjectURL(new Blob([buffer], { type }))
  const el  = document.getElementById('bg-image')
  el.style.backgroundImage = `url("${url}")`
  el.style.opacity         = '1'
  const vid = document.getElementById('bg-video')
  if (vid) { vid.style.opacity = '0'; vid.src = '' }
  setCanvasOpacity(true)
  hideBgPrompt()
}

// ── Video FPS cap ─────────────────────────────────────────────────────────────
// We draw the video onto a canvas at a throttled rate instead of showing
// the <video> element directly. This lets us cap CPU/GPU decode work.

let _videoFps          = 30
let _videoFrameMs      = 1000 / _videoFps
let _videoLastFrame    = 0
let _videoRafId        = null
let _videoDrawCanvas   = null
let _videoDrawCtx      = null

function stopVideoLoop() {
  if (_videoRafId) { cancelAnimationFrame(_videoRafId); _videoRafId = null }
}

function startVideoDrawLoop(videoEl) {
  stopVideoLoop()

  // Ensure we have an off-screen canvas
  if (!_videoDrawCanvas) {
    _videoDrawCanvas      = document.getElementById('bg-video-canvas')
    if (!_videoDrawCanvas) {
      _videoDrawCanvas        = document.createElement('canvas')
      _videoDrawCanvas.id     = 'bg-video-canvas'
      _videoDrawCanvas.style.cssText = `
        position:fixed;inset:0;width:100%;height:100%;
        object-fit:cover;z-index:-2;opacity:0;
        transition:opacity 0.6s ease;
      `
      document.body.insertBefore(_videoDrawCanvas, document.body.firstChild)
    }
    _videoDrawCtx = _videoDrawCanvas.getContext('2d')
  }

  function tick(now) {
    _videoRafId = requestAnimationFrame(tick)
    if (now - _videoLastFrame < _videoFrameMs) return
    _videoLastFrame = now

    if (videoEl.readyState >= 2) {
      _videoDrawCanvas.width  = window.innerWidth
      _videoDrawCanvas.height = window.innerHeight
      _videoDrawCtx.drawImage(videoEl, 0, 0, _videoDrawCanvas.width, _videoDrawCanvas.height)
    }
  }

  _videoRafId = requestAnimationFrame(tick)
}

export function setVideoFps(fps) {
  _videoFps     = Math.max(1, Math.min(60, fps))
  _videoFrameMs = 1000 / _videoFps
}

function applyVideoBuffer(buffer, type) {
  // We use a hidden <video> as the decode source, draw frames to canvas
  const hiddenVid = document.getElementById('bg-video')
  hiddenVid.style.opacity = '0'  // keep hidden — canvas draws the frames

  const url             = URL.createObjectURL(new Blob([buffer], { type }))
  hiddenVid.src         = url
  hiddenVid.muted       = true
  hiddenVid.loop        = true
  hiddenVid.playsInline = true

  hiddenVid.oncanplay = () => {
    hiddenVid.play().catch(() => {})
    if (_videoDrawCanvas) _videoDrawCanvas.style.opacity = '1'
    startVideoDrawLoop(hiddenVid)
  }

  const img = document.getElementById('bg-image')
  if (img) img.style.opacity = '0'
  setCanvasOpacity(true)
  hideBgPrompt()
}

/** Called by bg-rotation.js to apply a buffer from the rotation pool. */
export function applyBufferBackground(buffer, type) {
  if (type.startsWith('video/')) applyVideoBuffer(buffer, type)
  else                           applyImageBuffer(buffer, type)
}

// ── Restore prompt (shown when permission needs a gesture) ────────────────────

function showBgPrompt() {
  let el = document.getElementById('bg-restore-prompt')
  if (el) return
  el = document.createElement('div')
  el.id        = 'bg-restore-prompt'
  el.className = 'bg-restore-prompt'
  el.textContent = '⟳ Click anywhere to restore background'
  document.body.appendChild(el)
}

function hideBgPrompt() {
  document.getElementById('bg-restore-prompt')?.remove()
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Phase 1 — called automatically on startup (no user gesture).
 * Silently checks if permission is already granted and applies bg.
 * If permission needs a gesture, shows a faint prompt instead.
 */
export async function loadBackground() {
  try {
    const alreadyGranted = await checkBgPermissionSilent()
    if (alreadyGranted) {
      const result = await requestBgPermissionAndRead()
      if (result) {
        if (result.type.startsWith('video/')) applyVideoBuffer(result.buffer, result.type)
        else                                   applyImageBuffer(result.buffer, result.type)
        return
      }
    }

    // Permission not yet granted — check if a file is even configured
    const has = await hasBgFile()
    if (has) showBgPrompt()
  } catch { /* no bg configured */ }
}

/**
 * Phase 2 — called on first user click (inside a user gesture).
 * Requests permission and applies the background.
 * Safe to call even if no bg is configured — silently does nothing.
 */
export async function restoreBackground() {
  try {
    const result = await requestBgPermissionAndRead()
    if (!result) return
    if (result.type.startsWith('video/')) applyVideoBuffer(result.buffer, result.type)
    else                                   applyImageBuffer(result.buffer, result.type)
  } catch { /* ignore */ }
}

/**
 * Opens a file picker (image or video), saves handle to IndexedDB,
 * applies immediately. Returns filename or null on cancel.
 */
export async function pickAndApplyBackground() {
  if (!('showOpenFilePicker' in window)) return null
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: 'Image or Video',
        accept: {
          'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'],
          'video/*': ['.webm', '.mp4', '.mov'],
        }
      }],
      multiple: false,
    })

    const ok = await handle.requestPermission({ mode: 'read' })
    if (ok !== 'granted') return null

    await saveBgHandle(handle)

    const file   = await handle.getFile()
    const buffer = await file.arrayBuffer()

    if (file.type.startsWith('video/')) applyVideoBuffer(buffer, file.type)
    else                                applyImageBuffer(buffer, file.type)

    return file.name
  } catch { return null }
}

/**
 * Clear background — removes handle from IDB and hides all bg elements.
 */
export async function clearBackground() {
  await clearBgHandle()
  hideAll()
  hideBgPrompt()
  setCanvasOpacity(false)
}

// Backwards compat — used by URL-based preset loader in settings
export function applyBackground(dataUrl) {
  if (!dataUrl) { hideAll(); setCanvasOpacity(false); return }
  const el = document.getElementById('bg-image')
  el.style.backgroundImage = `url("${dataUrl}")`
  el.style.opacity         = '1'
  setCanvasOpacity(true)
}
