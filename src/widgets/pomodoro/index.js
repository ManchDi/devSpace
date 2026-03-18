/**
 * widgets/pomodoro/index.js
 * Pomodoro timer widget.
 *
 * State shape (stored under 'pomodoro'):
 * {
 *   focusMins: number,
 *   breakMins: number,
 * }
 */

import * as store from '../../lib/store.js'
import { formatTime, beep, toast } from '../../lib/utils.js'

const CIRCUM = 2 * Math.PI * 42  // radius 42 in SVG

const DEFAULT = { focusMins: 25, breakMins: 5 }

export class PomodoroWidget {
  constructor() {
    this.state = {
      running:   false,
      isBreak:   false,
      session:   1,
      total:     DEFAULT.focusMins * 60,
      remaining: DEFAULT.focusMins * 60,
      timer:     null,
    }
    this.cfg = { ...DEFAULT }
  }

  /** Called once by registry — returns the root DOM element */
  init() {
    const saved = store.get('pomodoro')
    if (saved) this.cfg = { ...DEFAULT, ...saved }

    this.state.total     = this.cfg.focusMins * 60
    this.state.remaining = this.state.total

    this.el = document.createElement('div')
    this.el.className = 'widget area-pomo'
    this.el.innerHTML = this._template()
    this._bindEvents()
    this._render()
    return this.el
  }

  _template() {
    return `
      <div class="widget-header">
        <span class="widget-label">Pomodoro</span>
        <span class="pomo-session-lbl" style="font-family:var(--font-mono);font-size:0.56rem;color:var(--text-muted)">Session 1</span>
      </div>

      <div class="pomo-ring-wrap">
        <div class="pomo-ring">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle class="ring-track" cx="50" cy="50" r="42"/>
            <circle class="ring-fill" cx="50" cy="50" r="42"
              stroke-dasharray="${CIRCUM.toFixed(2)}"
              stroke-dashoffset="0"/>
          </svg>
          <div class="pomo-center">
            <div class="pomo-time">25:00</div>
            <div class="pomo-mode">Focus</div>
          </div>
        </div>

        <div class="pomo-controls">
          <button class="pill-btn pomo-reset-btn" title="Reset">↺ Reset</button>
          <button class="pill-btn active pomo-toggle-btn">Start</button>
          <button class="pill-btn pomo-skip-btn" title="Skip">Skip ⟶</button>
        </div>

        <div class="pomo-dots">
          <div class="p-dot"></div>
          <div class="p-dot"></div>
          <div class="p-dot"></div>
          <div class="p-dot"></div>
        </div>
      </div>

      <div class="pomo-config">
        <div class="cfg-cell">
          <label>Focus min</label>
          <input type="number" class="cfg-focus" value="${this.cfg.focusMins}" min="1" max="120">
        </div>
        <div class="cfg-cell">
          <label>Break min</label>
          <input type="number" class="cfg-break" value="${this.cfg.breakMins}" min="1" max="60">
        </div>
      </div>
    `
  }

  _bindEvents() {
    this.el.querySelector('.pomo-toggle-btn').addEventListener('click', () => this.toggle())
    this.el.querySelector('.pomo-reset-btn').addEventListener('click',  () => this.reset())
    this.el.querySelector('.pomo-skip-btn').addEventListener('click',   () => this.skip())

    this.el.querySelector('.cfg-focus').addEventListener('change', () => this._cfgChanged())
    this.el.querySelector('.cfg-break').addEventListener('change', () => this._cfgChanged())
  }

  _cfgChanged() {
    this.cfg.focusMins = parseInt(this.el.querySelector('.cfg-focus').value) || 25
    this.cfg.breakMins = parseInt(this.el.querySelector('.cfg-break').value) || 5
    if (!this.state.running) {
      this.state.total     = this.cfg.focusMins * 60
      this.state.remaining = this.state.total
      this._render()
    }
    store.set('pomodoro', this.cfg)
  }

  toggle() {
    if (this.state.running) {
      this._pause()
    } else {
      this._start()
    }
  }

  _start() {
    this.state.running = true
    this.el.querySelector('.pomo-toggle-btn').textContent = 'Pause'
    this.state.timer = setInterval(() => {
      this.state.remaining--
      if (this.state.remaining <= 0) this._complete()
      else this._render()
    }, 1000)
  }

  _pause() {
    this.state.running = false
    clearInterval(this.state.timer)
    this.el.querySelector('.pomo-toggle-btn').textContent = 'Start'
  }

  _complete() {
    this._pause()
    beep()
    this.state.session++
    this.state.isBreak = !this.state.isBreak
    const mins = this.state.isBreak ? this.cfg.breakMins : this.cfg.focusMins
    this.state.total     = mins * 60
    this.state.remaining = this.state.total
    toast(this.state.isBreak ? 'Focus done — take a break!' : 'Break over — back to it!')
    this._render()
  }

  reset() {
    this._pause()
    this.state.isBreak   = false
    this.state.session   = 1
    this.state.total     = this.cfg.focusMins * 60
    this.state.remaining = this.state.total
    this._render()
  }

  skip() {
    this._pause()
    this._complete()
  }

  _render() {
    const { remaining, total, isBreak, session } = this.state

    // Time display
    this.el.querySelector('.pomo-time').textContent = formatTime(remaining)
    this.el.querySelector('.pomo-mode').textContent = isBreak ? 'Break' : 'Focus'
    this.el.querySelector('.pomo-session-lbl').textContent = `Session ${Math.ceil(session / 2)}`
    document.title = `${formatTime(remaining)} — DevStation`

    // Ring
    const pct    = remaining / total
    const offset = CIRCUM * (1 - pct)
    const ring   = this.el.querySelector('.ring-fill')
    ring.style.strokeDashoffset = offset.toFixed(2)
    ring.style.stroke = isBreak ? 'var(--success)' : 'var(--accent)'

    // Dots
    const dots = this.el.querySelectorAll('.p-dot')
    dots.forEach((d, i) => d.classList.toggle('lit', i < Math.floor((session - 1) / 2)))
  }

  // Keyboard shortcut handler (called from main.js)
  handleKey(e) {
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault()
      this.toggle()
    }
  }
}
