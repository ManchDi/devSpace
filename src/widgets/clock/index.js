/**
 * widgets/clock/index.js
 * Minimal clock — big HH:MM + date.
 * No widget-header — drag attaches to the widget root in main.js.
 * Toggle visibility via Settings only.
 */

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export class ClockWidget {
  init() {
    this.el = document.createElement('div')
    this.el.className = 'widget widget-clock-el'
    this.el.innerHTML = `
      <div class="clock-body">
        <div class="clock-time" id="clock-time">00:00</div>
        <div class="clock-date" id="clock-date">—</div>
      </div>
    `
    this._tick()
    this._timer = setInterval(() => this._tick(), 1000)
    return this.el
  }

  _tick() {
    const now  = new Date()
    const hh   = String(now.getHours()).padStart(2, '0')
    const mm   = String(now.getMinutes()).padStart(2, '0')
    const day  = DAYS[now.getDay()]
    const date = `${day}, ${MONTHS[now.getMonth()]} ${now.getDate()}`

    const timeEl = document.getElementById('clock-time')
    const dateEl = document.getElementById('clock-date')
    if (timeEl) timeEl.textContent = `${hh}:${mm}`
    if (dateEl) dateEl.textContent = date
  }

  destroy() {
    clearInterval(this._timer)
  }
}
