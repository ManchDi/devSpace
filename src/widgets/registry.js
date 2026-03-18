/**
 * widgets/registry.js
 * ─────────────────────────────────────────────────────────
 * THE ONLY FILE YOU NEED TO EDIT TO ADD/REMOVE A WIDGET.
 *
 * To add a new widget:
 *   1. Create  src/widgets/my-widget/index.js  exporting a class with `init()`
 *   2. Import it here
 *   3. Push an entry to WIDGETS below
 *
 * Each entry:
 *   id        — unique key used for the toggle in settings
 *   label     — display name in settings panel
 *   Widget    — class reference
 *   default   — shown by default? (user can toggle in settings)
 * ─────────────────────────────────────────────────────────
 */

import { PomodoroWidget } from './pomodoro/index.js'
import { KanbanWidget   } from './kanban/index.js'
import { NotesWidget    } from './notes/index.js'
import { GoalsWidget    } from './goals/index.js'
import { YouTubeWidget  } from './youtube/index.js'
import { QuotesWidget   } from './quotes/index.js'
import { ClockWidget    } from './clock/index.js'

export const WIDGETS = [
  { id: 'clock',    label: 'Clock',       Widget: ClockWidget,    default: true },
  { id: 'pomodoro', label: 'Pomodoro',    Widget: PomodoroWidget, default: true },
  { id: 'kanban',   label: 'Kanban',      Widget: KanbanWidget,   default: true },
  { id: 'notes',    label: 'Notes',       Widget: NotesWidget,    default: true },
  { id: 'goals',    label: 'Daily Goals', Widget: GoalsWidget,    default: true },
  { id: 'youtube',  label: 'Music',       Widget: YouTubeWidget,  default: true },
  { id: 'quotes',   label: 'Quotes',      Widget: QuotesWidget,   default: true },
]
