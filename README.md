# DevStation

> A no-backend coding session dashboard. Minimal, moody, built to stay out of your way.

Built with vanilla JS and Vite — no framework, no cloud, no accounts. Everything lives on your machine.

## Widgets

| Widget | Description |
|--------|-------------|
| **Clock** | Large HH:MM + date. Scales with resize via container query units. |
| **Pomodoro** | Ring timer with configurable focus/break lengths, audio beep, session dots. |
| **Kanban** | Drag-and-drop cards across Todo / In Progress / Done. |
| **Notes** | Multi-tab scratch pad. Auto-saves. |
| **Goals** | Daily intention + up to 8 checkable goals. |
| **YouTube** | Embedded player with 5 presets and a custom URL field. |
| **Quotes** | 17 developer quotes. Prev / Next / Random. |

All widgets are freely draggable and resizable. Positions and sizes persist across sessions.

## Stack

- **Vite** — build tool and dev server
- **Vanilla JS (ES Modules)** — no framework
- **File System Access API** — local file persistence with IndexedDB-backed handle storage
- **Canvas API** — animated blob background and FPS-throttled video rendering

## Getting Started

```bash
npm install
```

### Option A — Preview mode (daily use, lowest footprint)

```bash
npm run build    # compile once, or after any code change
npm run preview  # serves dist/ at localhost:4173
```

`npm run build` only needs to run again when you change the source.
`npm run preview` is a tiny static file server — near-zero CPU and RAM at rest.

> **Note:** Don't open `dist/index.html` directly in Chrome — Chrome blocks local file CORS and the page will be blank. Always use `npm run preview` or `npm run dev`.

### Option B — Dev mode (active development)

```bash
npm run dev    # localhost:5173 with hot module reload
```

Any file change reflects instantly in the browser. Slightly more resource usage due to HMR overhead.

### Option C — Single self-contained file (no server at all)

Install `vite-plugin-singlefile`:

```bash
npm install vite-plugin-singlefile --save-dev
```

Update `vite.config.js`:

```js
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: 'dist' },
})
```

`npm run build` now produces a fully self-contained `dist/index.html` — open it in any browser without a server.

---

## Data Persistence

DevStation uses a two-layer storage approach:

**Layer 1 — localStorage** (always on, automatic)
Fast synchronous reads/writes. Data is keyed to `localhost:4173`. Survives restarts but not browser data clears.

**Layer 2 — File System (recommended)**
Set up once via **Settings → Auto-Save to File**. Pick or create a `devstation-data.json` anywhere on disk. From then on:
- Every change is written to disk automatically (600ms debounce)
- On startup, disk data wins over localStorage
- Data survives browser clears, reinstalls, and switching Chromium browsers
- A green dot in Settings confirms the file is linked and syncing

> Requires Chrome, Edge, or Brave (File System Access API). Not supported in Firefox.

**Manual backup**
Settings → Export Backup downloads a dated `.json` snapshot at any time.

---

## Backgrounds

Upload any image or video file as your background via **Settings → Background → Upload Image / Video**.

- File handles are stored in IndexedDB — no base64, no size limit, persists across sessions
- Video backgrounds are rendered to a canvas with a **configurable FPS cap** (10–60fps) to control GPU load — set it in Settings → Video Background FPS
- **Wallpaper rotation** automatically cycles through a pool of wallpapers on a timer:
  - **Pick Folder** — uses every supported image/video inside a directory
  - **Pick Files** — use a hand-picked selection of files
  - Configurable interval (1–120 minutes), sequential or random order
  - "Next Wallpaper" button to advance manually

---

## Project Structure

```
src/
├── main.js                  # Entry — wires background, widgets, drag, settings
├── background.js            # Canvas blobs + FPS-throttled video rendering
├── styles/main.css          # All CSS — tokens, widget shells, widget-specific styles
├── lib/
│   ├── store.js             # localStorage wrapper with disk-sync
│   ├── fs-storage.js        # File System Access API + IndexedDB handle storage
│   ├── bg-rotation.js       # Wallpaper rotation engine + video FPS setting
│   ├── drag.js              # Drag manager — initDrag(el, handleEl, id)
│   ├── resize.js            # Resize handles — initResize(el, id)
│   └── utils.js             # toast, beep, formatTime, debounce, uid, applyAccent
├── settings/
│   └── index.js             # Floating ⚙ + slide-in settings panel
└── widgets/
    ├── registry.js          # ← Add new widgets here
    ├── clock/
    ├── pomodoro/
    ├── kanban/
    ├── notes/
    ├── goals/
    ├── youtube/
    └── quotes/
```

---

## Adding a New Widget

1. Create `src/widgets/my-widget/index.js`:

```js
export class MyWidget {
  init() {
    this.el = document.createElement('div')
    this.el.className = 'widget'
    this.el.innerHTML = `
      <div class="widget-header">
        <span class="widget-label">My Widget</span>
      </div>
      <div class="widget-body">...</div>
    `
    return this.el
  }
}
```

2. Add one line to `src/widgets/registry.js`:

```js
import { MyWidget } from './my-widget/index.js'
{ id: 'my-widget', label: 'My Widget', Widget: MyWidget, default: true }
```

3. Add a width rule to `src/styles/main.css`:

```css
.widget-my-widget { width: 300px; }
```

4. Add a default position to `src/lib/drag.js` → `DEFAULTS` and a default size to `src/lib/resize.js` → `DEFAULTS`.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl + Space` | Start / Pause Pomodoro |
| `S` | Open Settings |

---

## Browser Support

Requires a Chromium-based browser (Chrome, Edge, Brave) for full functionality — specifically the File System Access API used for local persistence and wallpaper rotation. Core widgets work in any modern browser; file-based features will be unavailable in Firefox and Safari.

---

## Customization

- **Colors & tokens** — edit CSS variables in `src/styles/main.css` under `:root`
- **Accent color** — configurable at runtime in Settings
- **Blob background** — edit the `BLOBS` array in `src/background.js`
- **Widget glass** — transparency slider in Settings (Solid → Ghost)