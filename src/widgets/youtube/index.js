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
    const saved      = store.get('youtube')
    this.videoId     = saved?.videoId     ?? DEFAULT_ID
    this.embedType   = saved?.embedType   ?? 'video'

    this.el = document.createElement('div')
    this.el.className = 'widget area-youtube'
    this.el.innerHTML = `
      <div class="widget-header">
        <span class="widget-label">Music</span>
      </div>
      <div class="widget-body">
        <div class="yt-frame-wrap">
          <iframe id="yt-iframe"
            src="${this._embedUrl(this.videoId, this.embedType)}"
            allowfullscreen
            allow="autoplay; encrypted-media">
          </iframe>
        </div>
        <div class="yt-input-row" style="margin-top:10px">
          <input class="text-input yt-url-inp" placeholder="Paste YouTube URL, playlist, or ID…">
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

    // Presets (always videos)
    this.el.querySelectorAll('.yt-preset').forEach(btn => {
      btn.addEventListener('click', () => this._load(btn.dataset.id, 'video'))
    })

    return this.el
  }

  _embedUrl(id, type = 'video') {
    if (type === 'playlist') {
      return `https://www.youtube.com/embed/videoseries?list=${id}&controls=1`
    }
    return `https://www.youtube.com/embed/${id}?controls=1`
  }

  _load(id, type = 'video') {
    this.videoId   = id
    this.embedType = type
    this.el.querySelector('#yt-iframe').src = this._embedUrl(id, type)
    store.set('youtube', { videoId: id, embedType: type })
  }

  _loadFromInput(inp) {
    const result = parseYouTubeId(inp.value)
    if (result) {
      this._load(result.id, result.type)
      inp.value = ''
    }
  }
}
