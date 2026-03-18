/**
 * widgets/quotes/index.js
 * Rotating developer quotes. Prev / Next / Random navigation.
 */

const QUOTES = [
  { text: 'Any fool can write code a computer understands. Good programmers write code humans understand.', author: 'Martin Fowler' },
  { text: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
  { text: 'Make it work, make it right, make it fast.', author: 'Kent Beck' },
  { text: 'The best way to predict the future is to implement it.', author: 'David H. Hansson' },
  { text: 'Code is like humor. When you have to explain it, it\'s bad.', author: 'Cory House' },
  { text: 'Clean code always looks like it was written by someone who cares.', author: 'Robert C. Martin' },
  { text: 'Simplicity is the soul of efficiency.', author: 'Austin Freeman' },
  { text: 'Programs must be written for people to read, and only incidentally for machines to execute.', author: 'Harold Abelson' },
  { text: 'The best error message is the one that never shows up.', author: 'Thomas Fuchs' },
  { text: 'One of the best programming skills you can have is knowing when to walk away for a while.', author: 'Oscar Godson' },
  { text: 'The function of good software is to make the complex appear to be simple.', author: 'Grady Booch' },
  { text: 'Every great developer you know got there by solving problems they were unqualified to solve until they did it.', author: 'Patrick McKenzie' },
  { text: 'The most dangerous phrase in the language is: we\'ve always done it this way.', author: 'Grace Hopper' },
  { text: 'Debugging is twice as hard as writing the code in the first place.', author: 'Brian W. Kernighan' },
  { text: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
  { text: 'It always seems impossible until it\'s done.', author: 'Nelson Mandela' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
]

export class QuotesWidget {
  constructor() {
    this.index = Math.floor(Math.random() * QUOTES.length)
  }

  init() {
    this.el = document.createElement('div')
    this.el.className = 'widget area-quotes'
    this.el.innerHTML = `
      <div class="widget-header">
        <span class="widget-label">Inspiration</span>
      </div>
      <div class="widget-body" style="display:flex;align-items:center;gap:20px">
        <div class="quote-wrap" style="flex:1">
          <div class="quote-text"></div>
          <div class="quote-author"></div>
        </div>
        <div class="quote-nav" style="flex-shrink:0">
          <button class="pill-btn q-prev">←</button>
          <button class="pill-btn q-next">→</button>
          <button class="pill-btn q-rand">⟳</button>
        </div>
      </div>
    `

    this.el.querySelector('.q-prev').addEventListener('click', () => this._prev())
    this.el.querySelector('.q-next').addEventListener('click', () => this._next())
    this.el.querySelector('.q-rand').addEventListener('click', () => this._random())

    this._render()
    return this.el
  }

  _prev()   { this.index = (this.index - 1 + QUOTES.length) % QUOTES.length; this._render() }
  _next()   { this.index = (this.index + 1) % QUOTES.length; this._render() }
  _random() { this.index = Math.floor(Math.random() * QUOTES.length); this._render() }

  _render() {
    const wrap = this.el.querySelector('.quote-wrap')
    wrap.style.opacity = '0'
    setTimeout(() => {
      const q = QUOTES[this.index]
      this.el.querySelector('.quote-text').textContent   = `"${q.text}"`
      this.el.querySelector('.quote-author').textContent = `— ${q.author}`
      wrap.style.transition = 'opacity 0.28s'
      wrap.style.opacity    = '1'
    }, 130)
  }
}
