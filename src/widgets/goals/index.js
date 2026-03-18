/**
 * widgets/goals/index.js
 * Daily intention + checklist of up to 8 goals.
 *
 * State shape (stored under 'goals'):
 * {
 *   intention: string,
 *   items: Array<{ id, text, done }>
 * }
 */

import * as store from '../../lib/store.js'
import { esc, uid, debounce } from '../../lib/utils.js'

const MAX_GOALS = 8

export class GoalsWidget {
  constructor() {
    this.data = { intention: '', items: [] }
  }

  init() {
    const saved = store.get('goals')
    if (saved) this.data = { ...this.data, ...saved }

    this.el = document.createElement('div')
    this.el.className = 'widget area-goals'
    this.el.innerHTML = `
      <div class="widget-header">
        <span class="widget-label">Daily Goals</span>
        <span class="goals-prog" style="font-family:var(--font-mono);font-size:0.56rem;color:var(--text-muted)">0 / 0</span>
      </div>
      <div class="widget-body">
        <textarea class="text-input goals-intention"
          rows="2"
          placeholder="Today I will focus on…"
          style="margin-bottom:12px;font-size:0.84rem;resize:none;line-height:1.6"
        ></textarea>
        <div class="goals-list"></div>
        <button class="add-goal-btn">+ Add Goal</button>
      </div>
    `

    const intentionTA = this.el.querySelector('.goals-intention')
    intentionTA.value = this.data.intention
    intentionTA.addEventListener('input', debounce(() => {
      this.data.intention = intentionTA.value
      this._save()
    }, 500))

    this.el.querySelector('.add-goal-btn').addEventListener('click', () => this._addGoal())

    this._render()
    return this.el
  }

  _addGoal() {
    if (this.data.items.length >= MAX_GOALS) return
    this.data.items.push({ id: uid(), text: '', done: false })
    this._render()
    // Focus the new input
    setTimeout(() => {
      const inputs = this.el.querySelectorAll('.goal-text')
      inputs[inputs.length - 1]?.focus()
    }, 30)
  }

  _toggle(id) {
    const item = this.data.items.find(i => i.id === id)
    if (item) item.done = !item.done
    this._render()
    this._save()
  }

  _remove(id) {
    this.data.items = this.data.items.filter(i => i.id !== id)
    this._render()
    this._save()
  }

  _render() {
    const list = this.el.querySelector('.goals-list')
    list.innerHTML = ''

    this.data.items.forEach(item => {
      const row = document.createElement('div')
      row.className = 'goal-row' + (item.done ? ' done' : '')
      row.innerHTML = `
        <div class="goal-check" data-id="${item.id}">${item.done ? '✓' : ''}</div>
        <input class="goal-text" value="${esc(item.text)}" placeholder="Goal…" data-id="${item.id}">
        <button class="goal-del" data-id="${item.id}">✕</button>
      `

      row.querySelector('.goal-check').addEventListener('click', () => this._toggle(item.id))
      row.querySelector('.goal-del').addEventListener('click',   () => this._remove(item.id))
      row.querySelector('.goal-text').addEventListener('input', debounce((e) => {
        const i = this.data.items.find(x => x.id === item.id)
        if (i) { i.text = e.target.value; this._save() }
      }, 400))

      list.appendChild(row)
    })

    const done  = this.data.items.filter(i => i.done).length
    const total = this.data.items.length
    this.el.querySelector('.goals-prog').textContent = `${done} / ${total}`
  }

  _save() {
    store.set('goals', this.data)
  }
}
