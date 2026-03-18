/**
 * widgets/notes/index.js
 * Multi-note widget — tab chips at top, textarea below.
 * Each note has a title (editable inline) and content.
 *
 * State shape (stored under 'notes'):
 * {
 *   notes:    Array<{ id, title, content }>,
 *   activeId: string | null,
 * }
 */

import * as store from '../../lib/store.js'
import { uid, debounce, esc } from '../../lib/utils.js'

const DEFAULT_NOTE = () => ({ id: uid(), title: 'Note', content: '' })

export class NotesWidget {
  constructor() {
    this.notes    = []
    this.activeId = null
  }

  init() {
    const saved = store.get('notes')

    // Migrate from old single-note format { content: string }
    if (saved?.content !== undefined && !Array.isArray(saved?.notes)) {
      this.notes    = [{ id: uid(), title: 'Note 1', content: saved.content ?? '' }]
      this.activeId = this.notes[0].id
    } else if (saved?.notes?.length) {
      this.notes    = saved.notes
      this.activeId = saved.activeId ?? this.notes[0].id
    } else {
      this.notes    = [DEFAULT_NOTE()]
      this.activeId = this.notes[0].id
    }

    this.el = document.createElement('div')
    this.el.className = 'widget'
    this.el.innerHTML = `
      <div class="widget-header">
        <span class="widget-label">Notes</span>
        <button class="icon-btn notes-add-btn" title="New note">+</button>
      </div>
      <div class="notes-tabs" id="notes-tabs"></div>
      <div class="widget-body notes-body">
        <textarea class="notes-textarea" placeholder="Start writing…"></textarea>
      </div>
    `

    this._ta = this.el.querySelector('.notes-textarea')

    this.el.querySelector('.notes-add-btn').addEventListener('click', () => this._addNote())

    this._ta.addEventListener('input', debounce(() => {
      const note = this._activeNote()
      if (note) { note.content = this._ta.value; this._save() }
    }, 400))

    this._renderTabs()
    this._loadActive()
    return this.el
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  _renderTabs() {
    const container = this.el.querySelector('#notes-tabs')
    container.innerHTML = ''

    this.notes.forEach(note => {
      const tab = document.createElement('div')
      tab.className = 'note-tab' + (note.id === this.activeId ? ' active' : '')
      tab.dataset.id = note.id

      const title = document.createElement('span')
      title.className   = 'note-tab-title'
      title.textContent = note.title
      title.title       = 'Double-click to rename'

      title.addEventListener('dblclick', () => this._renameTab(note.id, title))
      tab.addEventListener('click', e => {
        if (e.target === title && title.contentEditable === 'true') return
        this._switchNote(note.id)
      })

      const del = document.createElement('button')
      del.className   = 'note-tab-del'
      del.textContent = '×'
      del.title       = 'Delete note'
      del.addEventListener('click', e => {
        e.stopPropagation()
        this._deleteNote(note.id)
      })

      tab.appendChild(title)
      tab.appendChild(del)
      container.appendChild(tab)
    })
  }

  _renameTab(id, titleEl) {
    titleEl.contentEditable = 'true'
    titleEl.focus()
    // Select all text
    const range = document.createRange()
    range.selectNodeContents(titleEl)
    window.getSelection().removeAllRanges()
    window.getSelection().addRange(range)

    const finish = () => {
      titleEl.contentEditable = 'false'
      const note = this.notes.find(n => n.id === id)
      if (note) {
        note.title = titleEl.textContent.trim() || 'Note'
        titleEl.textContent = note.title
        this._save()
      }
    }

    titleEl.addEventListener('blur',    finish, { once: true })
    titleEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); titleEl.blur() }
    }, { once: true })
  }

  // ── Note management ───────────────────────────────────────────────────────

  _activeNote() {
    return this.notes.find(n => n.id === this.activeId) ?? null
  }

  _switchNote(id) {
    this.activeId = id
    this._renderTabs()
    this._loadActive()
    this._save()
  }

  _loadActive() {
    const note = this._activeNote()
    this._ta.value = note?.content ?? ''
    this._ta.focus()
  }

  _addNote() {
    const note = DEFAULT_NOTE()
    note.title = `Note ${this.notes.length + 1}`
    this.notes.push(note)
    this.activeId = note.id
    this._renderTabs()
    this._loadActive()
    this._save()

    // Start rename immediately
    setTimeout(() => {
      const tab   = this.el.querySelector(`.note-tab[data-id="${note.id}"] .note-tab-title`)
      if (tab) this._renameTab(note.id, tab)
    }, 50)
  }

  _deleteNote(id) {
    if (this.notes.length === 1) return // always keep at least one

    const idx = this.notes.findIndex(n => n.id === id)
    this.notes.splice(idx, 1)

    // If we deleted the active one, activate the nearest
    if (this.activeId === id) {
      this.activeId = this.notes[Math.max(0, idx - 1)].id
    }

    this._renderTabs()
    this._loadActive()
    this._save()
  }

  _save() {
    store.set('notes', { notes: this.notes, activeId: this.activeId })
  }
}
