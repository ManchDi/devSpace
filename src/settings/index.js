/**
 * settings/index.js
 * Floating gear trigger + slide-in settings panel.
 *
 * New in v3:
 *   - Background image upload + presets
 *   - Widget border toggle
 *   - Reset positions button
 */

import * as store from '../lib/store.js'
import { applyAccent, toast } from '../lib/utils.js'
import { pickAndApplyBackground, clearBackground } from '../background.js'
import { resetPositions } from '../lib/drag.js'
import { resetSizes } from '../lib/resize.js'
import {
  isSupported, pickSaveFile, hasSaveFile,
  getSaveFileName, unlinkSaveFile, writeToDisk,
  openExistingFile
} from '../lib/fs-storage.js'
import { WIDGETS } from '../widgets/registry.js'
import {
  pickDirectory, pickFiles, clearRotationPool,
  setRotationEnabled, setRotationInterval, setRotationOrder,
  rotateNow, getPoolInfo, getVideoBgFps, setVideoBgFps,
} from '../lib/bg-rotation.js'

const ACCENT_PRESETS = [
  '#c8976e',
  '#6db8a0',
  '#7b9ed9',
  '#d97ba0',
  '#a57bd9',
  '#c4c46a',
]

export class Settings {
  constructor(onToggleWidget) {
    this.onToggleWidget = onToggleWidget
  }

  init() {
    const root = document.getElementById('settings-root')
    root.innerHTML = `
      <button class="settings-trigger" id="settings-btn" title="Settings (S)">⚙</button>

      <div class="settings-overlay" id="s-overlay"></div>

      <div class="settings-panel" id="s-panel">
        <div class="settings-head">
          <span class="settings-title">Settings</span>
          <button class="icon-btn" id="s-close">✕</button>
        </div>

        <!-- Accent color -->
        <div class="settings-section" data-section="accent">
          <div class="settings-section-header">
            <span class="settings-section-label">Accent Color</span>
            <span class="settings-chevron">▾</span>
          </div>
          <div class="settings-section-body">
            <div class="color-swatches" id="s-swatches">
              ${ACCENT_PRESETS.map(c => `
                <div class="swatch" style="background:${c}" data-color="${c}"></div>
              `).join('')}
            </div>
            <div class="custom-color-row">
              <input type="color" id="s-color-picker" value="#c8976e" title="Custom color">
              <input class="text-input" id="s-hex-input" placeholder="#c8976e"
                style="font-family:var(--font-mono);font-size:0.7rem">
            </div>
          </div>
        </div>

        <!-- Background -->
        <div class="settings-section" data-section="background">
          <div class="settings-section-header">
            <span class="settings-section-label">Background</span>
            <span class="settings-chevron">▾</span>
          </div>
          <div class="settings-section-body">
            <div class="bg-presets" id="s-bg-presets">
              <div class="bg-preset" data-bg="none" title="Animated blobs (default)">
                <div class="bg-preset-inner" style="background:linear-gradient(135deg,#0b0d13,#1a1530)">
                  <span>default</span>
                </div>
              </div>
              <div class="bg-preset" data-bg="https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80" title="Mountain night">
                <div class="bg-preset-inner" style="background:linear-gradient(135deg,#1a1a2e,#16213e)">
                  <span>night</span>
                </div>
              </div>
              <div class="bg-preset" data-bg="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80" title="Space">
                <div class="bg-preset-inner" style="background:linear-gradient(135deg,#000011,#0a0020)">
                  <span>space</span>
                </div>
              </div>
              <div class="bg-preset" data-bg="https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=1920&q=80" title="Forest">
                <div class="bg-preset-inner" style="background:linear-gradient(135deg,#0d1f0d,#1a2e1a)">
                  <span>forest</span>
                </div>
              </div>
            </div>
            <button class="s-upload-btn" id="s-bg-upload">↑ Upload Image / Video</button>
            <button class="s-neutral-btn" id="s-bg-clear" style="margin-top:4px">Clear Background</button>

            <!-- Dim overlay slider -->
            <div class="transparency-row" style="margin-top:14px">
              <div class="transparency-labels">
                <span>None</span>
                <span class="transparency-title">Background Dim</span>
                <span>Dark</span>
              </div>
              <input type="range" id="s-bg-dim" min="0" max="80" value="0"
                class="transparency-slider">
              <div class="transparency-hint" id="s-bg-dim-hint">Off</div>
            </div>
          </div>
        </div>

        <!-- Wallpaper Rotation -->
        <div class="settings-section" data-section="rotation">
          <div class="settings-section-header">
            <span class="settings-section-label">Wallpaper Rotation</span>
            <span class="settings-chevron">▾</span>
          </div>
          <div class="settings-section-body">
            <div class="rotation-pool-row">
              <button class="s-neutral-btn" id="s-rot-pick-dir">📁 Pick Folder</button>
              <button class="s-neutral-btn" id="s-rot-pick-files">🖼 Pick Files</button>
            </div>
            <div class="rotation-pool-status" id="s-rot-status">No wallpaper pool set</div>
            <button class="s-neutral-btn" id="s-rot-clear" style="margin-top:4px;display:none">✕ Clear Pool</button>
            <div class="widget-toggle-row" id="s-rot-toggle-row" style="margin-top:10px;opacity:0.4;pointer-events:none">
              <span class="widget-toggle-label">Auto-rotate</span>
              <div class="toggle" id="tog-rotation"></div>
            </div>
            <div class="rotation-interval-row" id="s-rot-interval-row" style="margin-top:8px;opacity:0.4;pointer-events:none">
              <span class="widget-toggle-label">Change every</span>
              <div class="rotation-interval-input">
                <input type="number" id="s-rot-minutes" min="1" max="120" value="10"
                  class="text-input rotation-num-input">
                <span class="rotation-unit">min</span>
              </div>
            </div>
            <div class="rotation-order-row" id="s-rot-order-row" style="margin-top:8px;opacity:0.4;pointer-events:none">
              <span class="widget-toggle-label">Order</span>
              <div class="rotation-order-btns">
                <button class="rot-order-btn active" data-order="sequential">Sequential</button>
                <button class="rot-order-btn" data-order="random">Random</button>
              </div>
            </div>
            <button class="s-neutral-btn" id="s-rot-next" style="margin-top:8px;display:none">⏭ Next Wallpaper</button>
          </div>
        </div>

        <!-- Video FPS Cap -->
        <div class="settings-section" data-section="fps">
          <div class="settings-section-header">
            <span class="settings-section-label">Video Background FPS</span>
            <span class="settings-chevron">▾</span>
          </div>
          <div class="settings-section-body">
            <div class="transparency-row">
              <div class="transparency-labels">
                <span>10</span>
                <span class="transparency-title">FPS Cap</span>
                <span>60</span>
              </div>
              <input type="range" id="s-video-fps" min="10" max="60" step="5" value="30"
                class="transparency-slider">
              <div class="transparency-hint" id="s-fps-hint">30 fps</div>
            </div>
            <p class="settings-hint">Only affects video backgrounds. Lower = less GPU load.</p>
          </div>
        </div>

        <!-- Appearance -->
        <div class="settings-section" data-section="appearance">
          <div class="settings-section-header">
            <span class="settings-section-label">Appearance</span>
            <span class="settings-chevron">▾</span>
          </div>
          <div class="settings-section-body">
            <div class="widget-toggles">
              <div class="widget-toggle-row">
                <span class="widget-toggle-label">Widget Borders</span>
                <div class="toggle" id="tog-borders"></div>
              </div>
            </div>
            <div class="transparency-row">
              <div class="transparency-labels">
                <span>Solid</span>
                <span class="transparency-title">Widget Glass</span>
                <span>Ghost</span>
              </div>
              <input type="range" id="s-transparency" min="0" max="100" value="50"
                class="transparency-slider">
              <div class="transparency-hint" id="s-transparency-hint">Default</div>
            </div>
          </div>
        </div>

        <!-- Widget visibility -->
        <div class="settings-section" data-section="widgets">
          <div class="settings-section-header">
            <span class="settings-section-label">Widgets</span>
            <span class="settings-chevron">▾</span>
          </div>
          <div class="settings-section-body">
            <div class="widget-toggles" id="s-widget-toggles">
              ${WIDGETS.map(w => `
                <div class="widget-toggle-row">
                  <span class="widget-toggle-label">${w.label}</span>
                  <div class="toggle on" data-widget="${w.id}"></div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Layout -->
        <div class="settings-section" data-section="layout">
          <div class="settings-section-header">
            <span class="settings-section-label">Layout</span>
            <span class="settings-chevron">▾</span>
          </div>
          <div class="settings-section-body">
            <button class="s-neutral-btn" id="s-reset-positions">Reset Widget Positions</button>
            <button class="s-neutral-btn" id="s-reset-sizes">Reset Widget Sizes</button>
          </div>
        </div>

        <!-- Data persistence -->
        <div class="settings-section" data-section="autosave">
          <div class="settings-section-header">
            <span class="settings-section-label">Auto-Save to File</span>
            <span class="settings-chevron">▾</span>
          </div>
          <div class="settings-section-body">
            <div class="save-file-status" id="s-file-status">
              <span class="save-file-dot" id="s-file-dot"></span>
              <span class="save-file-name" id="s-file-name">Not configured</span>
            </div>
            <button class="s-neutral-btn" id="s-open-file">Open Existing File…</button>
            <button class="s-neutral-btn" id="s-pick-file">Create New Save File…</button>
            <button class="s-neutral-btn" id="s-unlink-file" style="display:none">Unlink Save File</button>
            <p class="settings-hint" id="s-fs-hint"></p>
          </div>
        </div>

        <!-- Data export -->
        <div class="settings-section" data-section="backup">
          <div class="settings-section-header">
            <span class="settings-section-label">Manual Backup</span>
            <span class="settings-chevron">▾</span>
          </div>
          <div class="settings-section-body">
            <button class="s-neutral-btn" id="s-export">Export Backup (JSON)</button>
            <button class="s-danger-btn"  id="s-clear">Clear All Data</button>
          </div>
        </div>

        <!-- Shortcuts -->
        <div class="settings-section" data-section="shortcuts">
          <div class="settings-section-header">
            <span class="settings-section-label">Shortcuts</span>
            <span class="settings-chevron">▾</span>
          </div>
          <div class="settings-section-body">
            <div class="shortcuts-list">
              <span>Ctrl+Space</span> — Start / Pause timer<br>
              <span>S</span> — Open settings
            </div>
          </div>
        </div>

      </div>
    `

    this._bindEvents()
    this._loadAccent()
    this._loadToggles()
    this._loadAppearance()
    this._loadRotationUI()
  }

  _bindEvents() {
    const panel   = document.getElementById('s-panel')
    const overlay = document.getElementById('s-overlay')
    const open    = () => { panel.classList.add('open'); overlay.classList.add('open') }
    const close   = () => { panel.classList.remove('open'); overlay.classList.remove('open') }

    document.getElementById('settings-btn').addEventListener('click', open)
    document.getElementById('s-close').addEventListener('click', close)
    overlay.addEventListener('click', close)

    // ── Accordion sections ────────────────────────────────────────────────────
    const savedOpen = (() => {
      try { return JSON.parse(localStorage.getItem('devstation_open_sections') ?? '[]') } catch { return [] }
    })()

    document.querySelectorAll('.settings-section').forEach(section => {
      const key    = section.dataset.section
      const header = section.querySelector('.settings-section-header')

      if (savedOpen.includes(key)) section.classList.add('open')

      header.addEventListener('click', () => {
        section.classList.toggle('open')
        const nowOpen = [...document.querySelectorAll('.settings-section.open')]
          .map(s => s.dataset.section)
        localStorage.setItem('devstation_open_sections', JSON.stringify(nowOpen))
      })
    })

    // ── Background dim slider ─────────────────────────────────────────────────
    const dimSlider = document.getElementById('s-bg-dim')
    const dimHint   = document.getElementById('s-bg-dim-hint')

    dimSlider.addEventListener('input', () => {
      const val = parseInt(dimSlider.value)
      this._applyBgDim(val)
      dimHint.textContent = val === 0 ? 'Off' : `${val}%`
    })
    dimSlider.addEventListener('change', () => {
      const val = parseInt(dimSlider.value)
      const d = store.get('settings') ?? {}
      store.set('settings', { ...d, bgDim: val })
    })

    // Accent swatches
    document.querySelectorAll('#s-swatches .swatch').forEach(sw => {
      sw.addEventListener('click', () => this._setAccent(sw.dataset.color))
    })

    const picker = document.getElementById('s-color-picker')
    const hexInp = document.getElementById('s-hex-input')
    picker.addEventListener('input', () => this._setAccent(picker.value))
    hexInp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        let v = hexInp.value.trim()
        if (!v.startsWith('#')) v = '#' + v
        if (/^#[0-9a-fA-F]{6}$/.test(v)) this._setAccent(v)
      }
    })

    // Background presets
    document.querySelectorAll('.bg-preset').forEach(preset => {
      preset.addEventListener('click', () => {
        const bg = preset.dataset.bg
        if (bg === 'none') {
          clearBackground()
        } else {
          // Load from URL → convert to data URL
          this._loadUrlAsBackground(bg)
        }
      })
    })

    // Background upload
    document.getElementById('s-bg-upload').addEventListener('click', async () => {
      const name = await pickAndApplyBackground()
      if (name) toast(`Background set: ${name}`)
    })

    document.getElementById('s-bg-clear').addEventListener('click', () => {
      clearBackground()
      toast('Background cleared')
    })

    // Border toggle
    document.getElementById('tog-borders').addEventListener('click', (e) => {
      const tog = e.currentTarget
      const on  = tog.classList.toggle('on')
      document.body.classList.toggle('widget-borders', on)
      const d = store.get('settings') ?? {}
      store.set('settings', { ...d, borders: on })
    })

    // Transparency slider
    const slider = document.getElementById('s-transparency')
    slider.addEventListener('input', () => {
      this._applyTransparency(parseInt(slider.value))
    })
    slider.addEventListener('change', () => {
      const d = store.get('settings') ?? {}
      store.set('settings', { ...d, transparency: parseInt(slider.value) })
    })

    // Widget toggles
    document.querySelectorAll('[data-widget]').forEach(tog => {
      tog.addEventListener('click', () => {
        const isOn = tog.classList.toggle('on')
        this.onToggleWidget(tog.dataset.widget, isOn)
        this._saveToggles()
      })
    })

    // Reset positions
    document.getElementById('s-reset-positions').addEventListener('click', () => {
      if (!confirm('Reset all widget positions to default?')) return
      resetPositions()
    })

    // Reset sizes
    document.getElementById('s-reset-sizes').addEventListener('click', () => {
      if (!confirm('Reset all widget sizes to default?')) return
      resetSizes()
      location.reload()
    })

    // Save file
    this._updateFileStatus()

    if (!isSupported()) {
      document.getElementById('s-fs-hint').textContent =
        'File System API not available in this browser. Use Chrome, Edge, or Brave.'
      document.getElementById('s-open-file').disabled = true
      document.getElementById('s-pick-file').disabled = true
    }

    // Open existing file — reads data in, uses it as source of truth
    document.getElementById('s-open-file').addEventListener('click', async () => {
      const result = await openExistingFile()
      if (!result) return

      const { data } = result
      if (data && Object.keys(data).length > 0) {
        // Load file data into localStorage and reload so all widgets pick it up
        localStorage.setItem('devstation_data', JSON.stringify(data))
        toast('File loaded — reloading…')
        setTimeout(() => location.reload(), 700)
      } else {
        // File was empty — write current data into it
        await writeToDisk(JSON.parse(store.exportJSON()))
        toast('Empty file linked — data written to it')
        this._updateFileStatus()
      }
    })

    // Create new save file — writes current data to it
    document.getElementById('s-pick-file').addEventListener('click', async () => {
      const handle = await pickSaveFile()
      if (handle) {
        await writeToDisk(JSON.parse(store.exportJSON()))
        toast('Save file created — all changes sync automatically')
        this._updateFileStatus()
      }
    })

    document.getElementById('s-unlink-file').addEventListener('click', async () => {
      if (!confirm('Stop syncing to this file? Your data stays in the browser.')) return
      await unlinkSaveFile()
      toast('Save file unlinked')
      this._updateFileStatus()
    })

    // Export
    document.getElementById('s-export').addEventListener('click', () => {
      const blob = new Blob([store.exportJSON()], { type: 'application/json' })
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = `devstation-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      toast('Backup downloaded')
    })

    // Clear all
    document.getElementById('s-clear').addEventListener('click', () => {
      if (!confirm('Clear ALL data? This cannot be undone.')) return
      store.clear()
      localStorage.removeItem('devstation_bg')
      location.reload()
    })

    // ── Wallpaper rotation events ─────────────────────────────────────────────

    document.getElementById('s-rot-pick-dir').addEventListener('click', async () => {
      const result = await pickDirectory()
      if (result) {
        toast(`Rotation pool: ${result.count} files from "${result.sourceName}"`)
        this._loadRotationUI()
      }
    })

    document.getElementById('s-rot-pick-files').addEventListener('click', async () => {
      const result = await pickFiles()
      if (result) {
        toast(`Rotation pool: ${result.sourceName}`)
        this._loadRotationUI()
      }
    })

    document.getElementById('s-rot-clear').addEventListener('click', async () => {
      await clearRotationPool()
      toast('Rotation pool cleared')
      this._loadRotationUI()
    })

    document.getElementById('tog-rotation').addEventListener('click', (e) => {
      const on = e.currentTarget.classList.toggle('on')
      setRotationEnabled(on)
      toast(on ? 'Wallpaper rotation on' : 'Wallpaper rotation off')
    })

    document.getElementById('s-rot-minutes').addEventListener('change', (e) => {
      const mins = Math.max(1, Math.min(120, parseInt(e.target.value) || 10))
      e.target.value = mins
      setRotationInterval(mins)
    })

    document.querySelectorAll('.rot-order-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.rot-order-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        setRotationOrder(btn.dataset.order)
      })
    })

    document.getElementById('s-rot-next').addEventListener('click', async () => {
      await rotateNow()
    })

    // ── Video FPS slider ──────────────────────────────────────────────────────

    const fpsSlider = document.getElementById('s-video-fps')
    const fpsHint   = document.getElementById('s-fps-hint')

    fpsSlider.addEventListener('input', () => {
      fpsHint.textContent = `${fpsSlider.value} fps`
    })
    fpsSlider.addEventListener('change', () => {
      const fps = parseInt(fpsSlider.value)
      setVideoBgFps(fps)
      fpsHint.textContent = `${fps} fps`
    })
  }

  _loadRotationUI() {
    const info       = getPoolInfo()
    const hasPool    = info.count > 0
    const status     = document.getElementById('s-rot-status')
    const clearBtn   = document.getElementById('s-rot-clear')
    const nextBtn    = document.getElementById('s-rot-next')
    const toggleRow  = document.getElementById('s-rot-toggle-row')
    const intervalRow = document.getElementById('s-rot-interval-row')
    const orderRow   = document.getElementById('s-rot-order-row')
    const togEl      = document.getElementById('tog-rotation')
    const minsEl     = document.getElementById('s-rot-minutes')

    if (hasPool) {
      const typeLabel = info.sourceType === 'directory' ? '📁' : '🖼'
      status.textContent = `${typeLabel} ${info.sourceName} — ${info.count} file${info.count !== 1 ? 's' : ''}`
      clearBtn.style.display  = ''
      nextBtn.style.display   = ''
      toggleRow.style.opacity  = '1'
      toggleRow.style.pointerEvents = ''
      intervalRow.style.opacity = '1'
      intervalRow.style.pointerEvents = ''
      orderRow.style.opacity   = '1'
      orderRow.style.pointerEvents = ''
    } else {
      status.textContent = 'No wallpaper pool set'
      clearBtn.style.display  = 'none'
      nextBtn.style.display   = 'none'
      toggleRow.style.opacity  = '0.4'
      toggleRow.style.pointerEvents = 'none'
      intervalRow.style.opacity = '0.4'
      intervalRow.style.pointerEvents = 'none'
      orderRow.style.opacity   = '0.4'
      orderRow.style.pointerEvents = 'none'
    }

    togEl.classList.toggle('on', info.enabled)
    minsEl.value = info.intervalMinutes

    // Order buttons
    document.querySelectorAll('.rot-order-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.order === info.order)
    })

    // FPS slider
    const fps = getVideoBgFps()
    const fpsSlider = document.getElementById('s-video-fps')
    const fpsHint   = document.getElementById('s-fps-hint')
    if (fpsSlider) { fpsSlider.value = fps }
    if (fpsHint)   { fpsHint.textContent = `${fps} fps` }
  }

  _loadUrlAsBackground(url) {
    toast('Loading background…')
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      // Downscale to max 1920px wide to keep size manageable
      const maxW   = 1920
      const scale  = Math.min(1, maxW / img.width)
      canvas.width  = img.width  * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
      try {
        localStorage.setItem('devstation_bg', dataUrl)
        const { applyBackground } = window.__bgFns ?? {}
        if (applyBackground) applyBackground(dataUrl)
        else location.reload() // fallback
        toast('Background set')
      } catch {
        alert('Image too large to store. Try a smaller image.')
      }
    }
    img.onerror = () => toast('Could not load preset image (network issue)')
    img.src = url
  }

  async _updateFileStatus() {
    const configured = await hasSaveFile()
    const dot        = document.getElementById('s-file-dot')
    const name       = document.getElementById('s-file-name')
    const unlinkBtn  = document.getElementById('s-unlink-file')

    if (configured) {
      const filename = await getSaveFileName()
      dot.classList.add('active')
      name.textContent = filename ?? 'devstation-data.json'
      unlinkBtn.style.display = ''
    } else {
      dot.classList.remove('active')
      name.textContent = 'Not configured'
      unlinkBtn.style.display = 'none'
    }
  }

  _setAccent(hex) {
    applyAccent(hex)
    document.getElementById('s-color-picker').value = hex
    document.getElementById('s-hex-input').value    = hex
    document.querySelectorAll('#s-swatches .swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.color === hex)
    })
    const d = store.get('settings') ?? {}
    store.set('settings', { ...d, accent: hex })
  }

  _loadAccent() {
    const saved = store.get('settings')
    const hex   = saved?.accent ?? ACCENT_PRESETS[0]
    applyAccent(hex)
    document.getElementById('s-color-picker').value = hex
    document.getElementById('s-hex-input').value    = hex
    document.querySelectorAll('#s-swatches .swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.color === hex)
    })
  }

  _loadAppearance() {
    const saved        = store.get('settings')
    const borders      = saved?.borders      ?? false
    const transparency = saved?.transparency ?? 50
    const bgDim        = saved?.bgDim        ?? 0

    const tog = document.getElementById('tog-borders')
    tog.classList.toggle('on', borders)
    document.body.classList.toggle('widget-borders', borders)

    const slider = document.getElementById('s-transparency')
    slider.value = transparency
    this._applyTransparency(transparency, false)

    const dimSlider = document.getElementById('s-bg-dim')
    const dimHint   = document.getElementById('s-bg-dim-hint')
    dimSlider.value     = bgDim
    dimHint.textContent = bgDim === 0 ? 'Off' : `${bgDim}%`
    this._applyBgDim(bgDim)
  }

  _applyBgDim(val) {
    const el = document.getElementById('bg-dim')
    if (el) el.style.opacity = (val / 100).toFixed(2)
  }

  /**
   * Transparency slider: 0 = Solid (max performance), 100 = Ghost (max aesthetic)
   *
   * At 0:   surface 0.88 opacity, blur 2px  — cheapest on GPU, most readable
   * At 50:  surface 0.72 opacity, blur 14px — default balance
   * At 100: surface 0.28 opacity, blur 28px — max glass, most GPU cost
   *
   * Lower blur = dramatically less GPU compositing work.
   */
  _applyTransparency(val, save = true) {
    const t       = val / 100
    const opacity = 0.88 - (t * 0.60)               // 0.88 → 0.28
    const blur    = Math.round(2 + (t * 26))         // 2px  → 28px
    const surface = `rgba(10, 12, 20, ${opacity.toFixed(2)})`

    document.documentElement.style.setProperty('--surface', surface)
    document.documentElement.style.setProperty('--blur', `${blur}px`)

    const labels = ['Solid', 'Balanced', 'Default', 'Glassy', 'Ghost']
    const idx    = Math.round(t * (labels.length - 1))
    const hint   = document.getElementById('s-transparency-hint')
    if (hint) hint.textContent = labels[idx]

    if (save) {
      const d = store.get('settings') ?? {}
      store.set('settings', { ...d, transparency: val })
    }
  }

  _saveToggles() {
    const state = {}
    document.querySelectorAll('[data-widget]').forEach(tog => {
      state[tog.dataset.widget] = tog.classList.contains('on')
    })
    const d = store.get('settings') ?? {}
    store.set('settings', { ...d, widgets: state })
  }

  _loadToggles() {
    const saved   = store.get('settings')
    const widgets = saved?.widgets ?? {}
    document.querySelectorAll('[data-widget]').forEach(tog => {
      const id   = tog.dataset.widget
      const isOn = widgets[id] !== undefined ? widgets[id] : true
      tog.classList.toggle('on', isOn)
      this.onToggleWidget(id, isOn)
    })
  }
}
