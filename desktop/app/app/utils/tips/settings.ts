import type { TipCategory } from './catalogue'
import { TIP_CATEGORIES } from './catalogue'

/**
 * The tips' settings, the app's own rather than the shell's overlay file: the
 * shell keeps only the fields it knows, so these live in `localStorage`,
 * which the app's window and the overlay's share — the panel hears a change
 * through the `storage` event.
 */
export interface TipSettings {
  /** The tips' text, under the objectives panel's strip — that panel on screen. */
  text: boolean
  /** The tips said by the voice pack (`pack`), whatever the overlay shows: off, a chosen pack stays chosen. */
  voice: boolean
  /** Each category on or off. */
  categories: Record<TipCategory, boolean>
  /** The voice pack spoken with the tips (`voice-store.ts`); none: text only. */
  pack: string | null
  /** 0 – 1. */
  volume: number
}

export const TIP_SETTINGS_KEY = 'truemain-tips'

/** Text and voice on, every category, no pack: a pack is the player's to import. ABSOL's volume, 60 %. */
export const DEFAULT_TIP_SETTINGS: TipSettings = {
  text: true,
  voice: true,
  categories: Object.fromEntries(TIP_CATEGORIES.map(category => [category, true])) as Record<TipCategory, boolean>,
  pack: null,
  volume: 0.6,
}

/** Read the stored settings leniently: a field missing or of the wrong kind is its default. */
export function readTipSettings(raw: string | null): TipSettings {
  let stored: Record<string, unknown> = {}
  try {
    const value: unknown = raw ? JSON.parse(raw) : {}
    if (value && typeof value === 'object') stored = value as Record<string, unknown>
  }
  catch {
    // Unreadable: the defaults.
  }
  const defaults = DEFAULT_TIP_SETTINGS
  const categories = (stored.categories && typeof stored.categories === 'object' ? stored.categories : {}) as Record<string, unknown>
  // Before text and voice were apart, one switch held both.
  const both = typeof stored.enabled === 'boolean' ? stored.enabled : null
  return {
    text: typeof stored.text === 'boolean' ? stored.text : both ?? defaults.text,
    voice: typeof stored.voice === 'boolean' ? stored.voice : both ?? defaults.voice,
    categories: Object.fromEntries(TIP_CATEGORIES.map(category => [category, typeof categories[category] === 'boolean' ? categories[category] : true])) as Record<TipCategory, boolean>,
    pack: typeof stored.pack === 'string' && stored.pack ? stored.pack : null,
    volume: typeof stored.volume === 'number' && stored.volume >= 0 && stored.volume <= 1 ? stored.volume : defaults.volume,
  }
}

/** Whether the tips are spoken: the voice on and a pack chosen. */
export const speaks = (settings: TipSettings) => settings.voice && settings.pack !== null

/** Whether the tips are read at all: shown, or spoken. */
export const tipsRunning = (settings: TipSettings) => settings.text || speaks(settings)
