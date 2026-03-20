/**
 * widgets/routine/index.js
 * Daily routine tracker — resets automatically each day.
 *
 * State shape (stored under 'routine'):
 * {
 *   lastReset: string,        // date string e.g. "Mon Mar 20 2026"
 *   editMode: boolean,
 *   items: Array<{ id, text, done, fixed }>
 * }
 *
 * fixed: true = can't be deleted (core habits)
 * fixed: false = user-added items
 */

import * as store from '../../lib/store.js'
import { esc, uid } from '../../lib/utils.js'

const DEFAULT_ITEMS = [
  { text: 'Eat a proper breakfast',            fixed: true  },
  { text: 'No weed — day complete',            fixed: true  },
  { text: 'Exercise / beach vb / gym / sauna', fixed: true  },
  { text: 'Read 1 file or 1 concept',          fixed: false },
  { text: 'Write code for 30+ min',            fixed: false },
  { text: 'Apply for 1 job',                   fixed: false },
  { text: 'Solve 1 LeetCode problem',          fixed: false },
  { text: 'Review what you built today',       fixed: false },
]

export class RoutineWidget {
  constructor() {
    this.data = {
      lastReset: '',
      editMode: false,
      items: DEFAULT_ITEMS.map(i => ({ id: uid(), text: i.text, done: false, fixed: i.fixed }))
    }
  }

  init() {
    const saved = store.get('routine')
    if (saved) {
      this.data = { ...this.data, ...saved }
    }

    // Auto-reset if it's a new day
    const today = new Date().toDateString()
    if (this.data.lastReset !== today) {
      this.data.items = this.data.items.map(i => ({ ...i, done: false }))
      this.data.lastReset = today
      this.data.editMode = false
      this._save()
    }

    this.el = document.createElement('div')
    this.el.className = 'widget widget-routine'
    this._build()
    return this.el
  }

  _build() {
    const done  = this.data.items.filter(i => i.done).length
    const total = this.data.items.length
    const pct   = total === 0 ? 0 : Math.round((done / total) * 100)
    const allDone = done === total && total > 0
    const editMode = this.data.editMode

    this.el.innerHTML = `
      <div class="widget-header">
        <span class="widget-label">Daily Routine</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="routine-prog"
            style="font-family:var(--font-mono);font-size:0.56rem;color:${allDone ? 'var(--success)' : 'var(--text-muted)'}">
            ${allDone ? '✓ Done' : `${done} / ${total}`}
          </span>
          <button class="routine-edit-btn icon-btn" title="${editMode ? 'Done editing' : 'Edit routine'}"
            style="${editMode ? 'color:var(--accent);border-color:var(--accent)' : ''}">
            ${editMode ? '✓' : '✎'}
          </button>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="routine-progress-wrap">
        <div class="routine-progress-bar" style="width:${pct}%;background:${allDone ? 'var(--success)' : 'var(--accent)'}"></div>
      </div>

      <div class="widget-body">
        ${allDone && !editMode ? `
          <div class="routine-complete-msg">
            <div style="font-size:1.4rem;margin-bottom:6px">🏆</div>
            <div style="font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.12em;color:var(--success);text-transform:uppercase">
              Routine complete
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;line-height:1.5">
              You showed up today. That's the work.
            </div>
          </div>
        ` : ''}

        <div class="routine-list ${allDone && !editMode ? 'routine-list-hidden' : ''}"></div>

        ${editMode ? `
          <button class="routine-add-btn">+ Add item</button>
        ` : ''}

        ${!editMode ? `
          <div class="routine-date">
            ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        ` : ''}
      </div>
    `

    this._renderList()
    this._bindEvents()
  }

  _renderList() {
    const list = this.el.querySelector('.routine-list')
    if (!list) return
    list.innerHTML = ''

    this.data.items.forEach(item => {
      const row = document.createElement('div')
      row.className = 'routine-row' + (item.done ? ' done' : '')

      if (this.data.editMode) {
        row.innerHTML = `
          <div class="routine-drag-handle">⠿</div>
          <input class="routine-edit-input" value="${esc(item.text)}" data-id="${item.id}" placeholder="Task…">
          ${!item.fixed ? `<button class="routine-del-btn" data-id="${item.id}" title="Remove">✕</button>` : '<span style="width:18px;flex-shrink:0"></span>'}
        `
        row.querySelector('.routine-edit-input').addEventListener('input', (e) => {
          const i = this.data.items.find(x => x.id === item.id)
          if (i) { i.text = e.target.value; this._save() }
        })
        if (!item.fixed) {
          row.querySelector('.routine-del-btn').addEventListener('click', () => {
            this.data.items = this.data.items.filter(x => x.id !== item.id)
            this._save()
            this._rebuild()
          })
        }
      } else {
        row.innerHTML = `
          <div class="routine-check ${item.done ? 'checked' : ''}" data-id="${item.id}">
            ${item.done ? '✓' : ''}
          </div>
          <span class="routine-text">${esc(item.text)}</span>
        `
        row.querySelector('.routine-check').addEventListener('click', () => this._toggle(item.id))
      }

      list.appendChild(row)
    })
  }

  _bindEvents() {
    this.el.querySelector('.routine-edit-btn').addEventListener('click', () => {
      this.data.editMode = !this.data.editMode
      this._save()
      this._rebuild()
    })

    const addBtn = this.el.querySelector('.routine-add-btn')
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.data.items.push({ id: uid(), text: '', done: false, fixed: false })
        this._save()
        this._rebuild()
        setTimeout(() => {
          const inputs = this.el.querySelectorAll('.routine-edit-input')
          inputs[inputs.length - 1]?.focus()
        }, 30)
      })
    }
  }

  _toggle(id) {
    const item = this.data.items.find(i => i.id === id)
    if (item) item.done = !item.done
    this._save()
    this._rebuild()
  }

  _rebuild() {
    this._build()
  }

  _save() {
    store.set('routine', this.data)
  }
}
