/**
 * widgets/youtube/index.js
 * YouTube music player with presets and custom URL input.
 *
 * State shape (stored under 'youtube'):
 * { videoId: string }
 */

import * as store from '../../lib/store.js'
import { parseYouTubeId } from '../../lib/utils.js'

const PRESETS = [
  { label: 'Lo-fi Beats',   id: 'jfKfPfyJRdk' },
  { label: 'Deep Focus',    id: 'DWcJFNfaw9c' },
  { label: 'Chillhop',      id: '5qap5aO4i9A' },
  { label: 'Dark Ambient',  id: 'HMnrl0tmd3k' },
  { label: 'Jazz Vibes',    id: 'n61ULEU7CO0' },
]

const DEFAULT_ID = PRESETS[0].id

export class YouTubeWidget {
  init() {
    const saved  = store.get('youtube')
    this.videoId = saved?.videoId ?? DEFAULT_ID

    this.el = document.createElement('div')
    this.el.className = 'widget area-youtube'
    this.el.innerHTML = `
      <div class="widget-header">
        <span class="widget-label">Music</span>
      </div>
      <div class="widget-body">
        <div class="yt-frame-wrap">
          <iframe id="yt-iframe"
            src="${this._embedUrl(this.videoId)}"
            allowfullscreen
            allow="autoplay; encrypted-media">
          </iframe>
        </div>
        <div class="yt-input-row" style="margin-top:10px">
          <input class="text-input yt-url-inp" placeholder="Paste YouTube URL or ID…">
          <button class="yt-load-btn">Load</button>
        </div>
        <div class="yt-presets">
          ${PRESETS.map(p => `
            <button class="yt-preset" data-id="${p.id}">${p.label}</button>
          `).join('')}
        </div>
      </div>
    `

    // Load custom URL
    const inp = this.el.querySelector('.yt-url-inp')
    this.el.querySelector('.yt-load-btn').addEventListener('click', () => this._loadFromInput(inp))
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') this._loadFromInput(inp) })

    // Presets
    this.el.querySelectorAll('.yt-preset').forEach(btn => {
      btn.addEventListener('click', () => this._load(btn.dataset.id))
    })

    return this.el
  }

  _embedUrl(id) {
    return `https://www.youtube.com/embed/${id}?controls=1`
  }

  _load(id) {
    this.videoId = id
    this.el.querySelector('#yt-iframe').src = this._embedUrl(id)
    store.set('youtube', { videoId: id })
  }

  _loadFromInput(inp) {
    const id = parseYouTubeId(inp.value)
    if (id) {
      this._load(id)
      inp.value = ''
    }
  }
}
