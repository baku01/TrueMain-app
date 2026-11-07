import { tr } from '#common/utils/i18n'

/** Mirrors `OverlayPanel` in `crates/shell-state/src/overlay.rs`: one window each. */
export type OverlayPanel = 'next-item' | 'win-probability' | 'item-value' | 'stats' | 'objectives' | 'lane-gold' | 'tips'
export const OVERLAY_PANELS: OverlayPanel[] = ['next-item', 'win-probability', 'stats', 'objectives', 'tips', 'item-value', 'lane-gold']

/** Mirrors `OverlayPanel::on_scoreboard`: placed on the game's scoreboard, never dragged. */
export const onScoreboard = (panel: OverlayPanel) => panel === 'lane-gold'

/** Mirrors `OverlayPanel::see_through`: a window with no background, the page drawing only what covers the game. */
export const seeThrough = (panel: OverlayPanel) => panel === 'lane-gold'

/** Mirrors `TIPS_PLACE`: the tips' own place until dragged, under the objectives' strip. */
export const TIPS_PLACE = { x: 0.5, y: 0.14 } as const

/** The dictionary keys of what each panel is called and shows (`i18n/overlay.ts`). */
const PANEL_TEXT: Record<OverlayPanel, { label: string, description: string }> = {
  'next-item': { label: 'overlay.panel.nextItem.label', description: 'overlay.panel.nextItem.description' },
  'win-probability': { label: 'overlay.panel.winProbability.label', description: 'overlay.panel.winProbability.description' },
  'stats': { label: 'overlay.panel.stats.label', description: 'overlay.panel.stats.description' },
  'item-value': { label: 'overlay.panel.itemValue.label', description: 'overlay.panel.itemValue.description' },
  'objectives': { label: 'overlay.panel.objectives.label', description: 'overlay.panel.objectives.description' },
  'lane-gold': { label: 'overlay.panel.laneGold.label', description: 'overlay.panel.laneGold.description' },
  'tips': { label: 'overlay.panel.tips.label', description: 'overlay.panel.tips.description' },
}

/** What each panel is called and shows, for the player choosing them, in the active language. */
export const OVERLAY_PANEL_INFO = Object.fromEntries(OVERLAY_PANELS.map(panel => [panel, {
  get label() { return tr(PANEL_TEXT[panel].label) },
  get description() { return tr(PANEL_TEXT[panel].description) },
}])) as Record<OverlayPanel, { label: string, description: string }>

export type OverlayShow = 'always' | 'whileDead'
export type OverlayAnchor = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center-right'

/**
 * Mirrors `Chord` in `crates/shell-state/src/keys.rs`: the modifiers and TAB
 * held, and at most one key, by its `KeyboardEvent.code` — a key position, so
 * the chord holds on any layout.
 */
export interface Chord {
  alt: boolean
  shift: boolean
  ctrl: boolean
  /** ⌘ on macOS, the Windows key on Windows. */
  meta: boolean
  tab: boolean
  key: string | null
}

/** Mirrors `PanelTrigger`: what brings a panel on screen in game. */
export type PanelTrigger =
  | { kind: 'always' }
  | { kind: 'whileHeld', chord: Chord }
  | { kind: 'toggle', chord: Chord, startShown: boolean }

/** Mirrors `PanelSettings`. */
export interface OverlayPanelSettings {
  enabled: boolean
  anchor: OverlayAnchor
  /** Where the panel was dragged, as a fraction of the room the screen leaves around it (0 against the left/top edge, 1 against the right/bottom); wins over `anchor`. */
  custom: { x: number, y: number } | null
  trigger: PanelTrigger
  /** The panel's size, 0.8 – 1.4 (`OVERLAY_SCALE`). */
  scale: number
}

/** Mirrors `OverlaySettings`. */
export interface OverlaySettings {
  /** The whole overlay. */
  enabled: boolean
  /** When the next item shows. */
  show: OverlayShow
  /** 0.5 – 1, every panel. */
  opacity: number
  nextItem: OverlayPanelSettings
  winProbability: OverlayPanelSettings
  itemValue: OverlayPanelSettings
  stats: OverlayPanelSettings
  objectives: OverlayPanelSettings
  /** Placed by the scoreboard: its anchor and custom place are never read. */
  laneGold: OverlayPanelSettings
  /** On its own place (`TIPS_PLACE`) until dragged. */
  tips: OverlayPanelSettings
  /** The lane-gold plates moved up (negative) or down, in pixels of a 1080p screen, ±`SCOREBOARD_NUDGE`. */
  scoreboardNudge: number
}

/** Mirrors `HudSettings` in `crates/shell-state/src/scoreboard.rs`: the client's HUD the scoreboard follows. */
export interface HudSettings {
  /** League's HUD scale, 0 – 1. */
  globalScale: number
  /** "Mirror scoreboard layout": the rows read inwards; the teams and the rows stay where they are. */
  mirrored: boolean
  /** Read from the client rather than Riot's defaults. */
  own: boolean
}

/** The settings key of each panel. */
export const PANEL_KEY = {
  'next-item': 'nextItem',
  'win-probability': 'winProbability',
  'item-value': 'itemValue',
  'stats': 'stats',
  'objectives': 'objectives',
  'lane-gold': 'laneGold',
  'tips': 'tips',
} as const satisfies Record<OverlayPanel, keyof OverlaySettings>

/** Mirrors `OverlayView` in `src-tauri/src/overlay/mod.rs`. */
export interface OverlayView {
  settings: OverlaySettings
  /** False where there is no window layer for the overlay (Linux). */
  supported: boolean
  /** The settings page is showing the panels on screen to place them. */
  preview: boolean
  /** The hide/show key, as the player presses it. */
  shortcut: string
  /** A condition the platform puts on the overlay (Windows: no Full Screen). */
  notice: string | null
  /** Each panel's chord, by panel, if it has one. */
  chords: Partial<Record<OverlayPanel, ChordView>>
  /** The warnings come from the player's own League keybindings, not Riot's defaults. */
  ownBinds: boolean
  /** The HUD the lane-gold plates are placed by. */
  hud: HudSettings
}

/** Mirrors `ChordView`: a chord as the player presses it, and what it also does in game. */
export interface ChordView {
  label: string
  warning: string | null
}

/** Mirrors `TriggerCheck`: the shell's answer about a trigger before it is saved. */
export interface TriggerCheck {
  refusal: string | null
  chord: ChordView | null
}

export const OVERLAY_SCALE = { min: 0.8, max: 1.4 } as const
export const OVERLAY_OPACITY = { min: 0.5, max: 1 } as const
/** Mirrors `scoreboard::MAX_NUDGE`. */
export const SCOREBOARD_NUDGE = 60
/** Mirrors `HudSettings::DEFAULTS`: a new League install's HUD. */
export const DEFAULT_HUD: HudSettings = { globalScale: 0, mirrored: false, own: false }

const TAB_HELD = { kind: 'whileHeld', chord: { alt: false, shift: false, ctrl: false, meta: false, tab: true, key: null } } as const

/** What a browser-only `npm run dev` shows: the shell's defaults. */
export const DEV_OVERLAY_VIEW: OverlayView = {
  settings: {
    enabled: true,
    show: 'always',
    opacity: 0.95,
    nextItem: { enabled: true, anchor: 'top-right', custom: null, trigger: { kind: 'always' }, scale: 1 },
    winProbability: { enabled: true, anchor: 'top-left', custom: null, trigger: { kind: 'always' }, scale: 1 },
    itemValue: { enabled: true, anchor: 'center-right', custom: null, trigger: TAB_HELD, scale: 1 },
    stats: { enabled: true, anchor: 'center-left', custom: null, trigger: { kind: 'always' }, scale: 1 },
    objectives: { enabled: true, anchor: 'top-center', custom: null, trigger: { kind: 'always' }, scale: 1 },
    laneGold: { enabled: true, anchor: 'top-center', custom: null, trigger: TAB_HELD, scale: 1 },
    tips: { enabled: true, anchor: 'top-center', custom: { ...TIPS_PLACE }, trigger: { kind: 'always' }, scale: 1 },
    scoreboardNudge: 0,
  },
  supported: true,
  preview: false,
  shortcut: '⌥⇧O',
  notice: null,
  chords: { 'item-value': { label: 'Tab', warning: null }, 'lane-gold': { label: 'Tab', warning: null } },
  ownBinds: false,
  hud: DEFAULT_HUD,
}
