/**
 * utils.js
 * Shared utility functions used across widgets.
 */

/** HTML-escape a string to safely insert as text content */
export function esc(str) {
  return (str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Debounce a function */
export function debounce(fn, ms = 400) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

/** Generate a short unique id */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

/** Show the global toast notification */
export function toast(msg, duration = 2500) {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(el._t)
  el._t = setTimeout(() => el.classList.remove('show'), duration)
}

/** Parse a YouTube URL or ID → video ID, or null */
/**
 * Parse a YouTube URL into { type, id } where type is 'video' or 'playlist'.
 * Handles:
 *   - youtube.com/watch?v=ID
 *   - youtube.com/watch?v=ID&list=PLID   (video inside playlist → treat as playlist)
 *   - youtube.com/playlist?list=PLID
 *   - youtu.be/ID
 *   - music.youtube.com/watch?v=ID
 *   - music.youtube.com/playlist?list=PLID
 *   - bare 11-char video ID
 */
export function parseYouTubeId(input) {
  const clean = input.trim()
  try {
    // Normalise music.youtube.com → youtube.com for URL parsing
    const normalised = clean.replace(/music\.youtube\.com/, 'youtube.com')
    const url = new URL(normalised.startsWith('http') ? normalised : `https://${normalised}`)
    const list  = url.searchParams.get('list')
    const v     = url.searchParams.get('v')

    // Explicit playlist page, or video page that also has a list param → use playlist
    if (list) return { type: 'playlist', id: list }
    if (v)    return { type: 'video',    id: v }

    // youtu.be/ID
    const shortMatch = url.pathname.match(/\/([a-zA-Z0-9_-]{11})$/)
    if (shortMatch) return { type: 'video', id: shortMatch[1] }
  } catch { /* not a URL — fall through */ }

  // Bare 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return { type: 'video', id: clean }
  return null
}

/** Apply accent color CSS variable + derived glow/dim */
export function applyAccent(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const root = document.documentElement
  root.style.setProperty('--accent',      hex)
  root.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.18)`)
  root.style.setProperty('--accent-dim',  `rgba(${r},${g},${b},0.10)`)
}

/** Format seconds → MM:SS string */
export function formatTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Play a short two-tone completion beep */
export function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[0, 0.2].forEach((delay) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = delay === 0 ? 880 : 660
      gain.gain.setValueAtTime(0.22, ctx.currentTime + delay)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.45)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + 0.45)
    })
  } catch { /* AudioContext blocked — silent fail */ }
}
