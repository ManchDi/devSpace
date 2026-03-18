/**
 * widgets/kanban/index.js
 * Kanban board — Todo / In Progress / Done
 *
 * - Cards are only created in Todo
 * - Cards can be dragged between any column
 * - Delete button on each card
 *
 * State shape (stored under 'kanban'):
 * {
 *   todo:       Array<{ id, text }>,
 *   inprogress: Array<{ id, text }>,
 *   done:       Array<{ id, text }>,
 * }
 */

import * as store from '../../lib/store.js'
import { esc, uid } from '../../lib/utils.js'

const COLS = [
  { id: 'todo',       label: 'Todo',        dotClass: 'k-dot-todo'  },
  { id: 'inprogress', label: 'In Progress',  dotClass: 'k-dot-doing' },
  { id: 'done',       label: 'Done',         dotClass: 'k-dot-done'  },
]

const DEFAULT_DATA = { todo: [], inprogress: [], done: [] }

export class KanbanWidget {
  constructor() {
    this.data    = { ...DEFAULT_DATA }
    this.dragId  = null   // card id being dragged
    this.dragCol = null   // source column
  }

  init() {
    const saved = store.get('kanban')
    if (saved) this.data = { todo: [], inprogress: [], done: [], ...saved }

    this.el = document.createElement('div')
    this.el.className = 'widget'
    this.el.innerHTML = `
      <div class="widget-header">
        <span class="widget-label">Kanban</span>
      </div>
      <div class="widget-body">
        <div class="kanban-board">
          ${COLS.map(col => `
            <div class="k-col" data-col="${col.id}">
              <div class="k-col-head">
                <div class="k-col-title">
                  <span class="k-dot ${col.dotClass}"></span>${col.label}
                </div>
                <span class="k-count" data-count="${col.id}">0</span>
              </div>
              <div class="k-cards" data-cards="${col.id}"></div>
              ${col.id === 'todo' ? `
                <div class="k-add-row">
                  <input class="k-input" data-input="todo" placeholder="Add task…">
                  <button class="k-add-btn" data-add="todo">+</button>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `

    this._bindStaticEvents()
    this._render()
    return this.el
  }

  // ── Static event bindings (inputs, add button) ────────────────────────────

  _bindStaticEvents() {
    const addBtn = this.el.querySelector('[data-add]')
    const addInp = this.el.querySelector('[data-input]')

    addBtn?.addEventListener('click',  () => this._addCard())
    addInp?.addEventListener('keydown', e => { if (e.key === 'Enter') this._addCard() })

    // Column drop zones
    this.el.querySelectorAll('.k-col').forEach(col => {
      col.addEventListener('dragover',   e => this._onDragOver(e, col))
      col.addEventListener('dragleave',  e => this._onDragLeave(e, col))
      col.addEventListener('drop',       e => this._onDrop(e, col.dataset.col))
    })
  }

  // ── Card creation ─────────────────────────────────────────────────────────

  _addCard() {
    const inp  = this.el.querySelector('[data-input="todo"]')
    const text = inp.value.trim()
    if (!text) return
    this.data.todo.push({ id: uid(), text })
    inp.value = ''
    this._render()
    this._save()
  }

  _deleteCard(colId, cardId) {
    this.data[colId] = this.data[colId].filter(c => c.id !== cardId)
    this._render()
    this._save()
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────

  _onDragStart(e, colId, cardId) {
    this.dragId  = cardId
    this.dragCol = colId
    e.dataTransfer.effectAllowed = 'move'
    // Small timeout so the dragging element doesn't lose style instantly
    setTimeout(() => {
      const card = this.el.querySelector(`[data-card-id="${cardId}"]`)
      card?.classList.add('k-card-dragging')
    }, 0)
  }

  _onDragEnd(cardId) {
    const card = this.el.querySelector(`[data-card-id="${cardId}"]`)
    card?.classList.remove('k-card-dragging')
    this.el.querySelectorAll('.k-col').forEach(c => c.classList.remove('k-col-over'))
  }

  _onDragOver(e, colEl) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    colEl.classList.add('k-col-over')
  }

  _onDragLeave(e, colEl) {
    // Only remove if we're leaving the column entirely (not going into a child)
    if (!colEl.contains(e.relatedTarget)) {
      colEl.classList.remove('k-col-over')
    }
  }

  _onDrop(e, toColId) {
    e.preventDefault()
    this.el.querySelectorAll('.k-col').forEach(c => c.classList.remove('k-col-over'))

    if (!this.dragId || this.dragCol === toColId) return

    const idx  = this.data[this.dragCol].findIndex(c => c.id === this.dragId)
    if (idx === -1) return

    const [card] = this.data[this.dragCol].splice(idx, 1)
    this.data[toColId].push(card)

    this.dragId  = null
    this.dragCol = null
    this._render()
    this._save()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  _render() {
    COLS.forEach(col => {
      const cards     = this.data[col.id]
      const container = this.el.querySelector(`[data-cards="${col.id}"]`)
      this.el.querySelector(`[data-count="${col.id}"]`).textContent = cards.length

      container.innerHTML = ''

      cards.forEach(card => {
        const div = document.createElement('div')
        div.className    = 'k-card'
        div.draggable    = true
        div.dataset.cardId = card.id
        div.innerHTML    = `
          <span class="k-card-text">${esc(card.text)}</span>
          <button class="k-card-rm" title="Remove">✕</button>
        `

        div.addEventListener('dragstart', e => this._onDragStart(e, col.id, card.id))
        div.addEventListener('dragend',   ()  => this._onDragEnd(card.id))
        div.querySelector('.k-card-rm').addEventListener('click', () =>
          this._deleteCard(col.id, card.id)
        )

        container.appendChild(div)
      })
    })
  }

  _save() {
    store.set('kanban', this.data)
  }
}
