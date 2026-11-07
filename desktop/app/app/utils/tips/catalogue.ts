import type { VOICE_KEYS } from './voice-keys'

/**
 * The in-game tips (`engine.ts` decides when), each a stable key — its text is
 * `tip.<key>` in the dictionaries (`i18n/tips.ts`), its voice the pack's clip
 * of the same name (`voice-keys.ts`) — with what a queue needs to order it:
 * its category, its priority and how long it stays worth saying.
 *
 * The rules and thresholds come from ABSOL's coach, as far as the data the
 * shell sends goes (`types/game.ts`); the phrases are TrueMain's own.
 */

export type TipCategory = 'objective' | 'jungle' | 'kill' | 'mental' | 'level' | 'recall' | 'farm' | 'ward' | 'gold' | 'map'

/** In the order the settings list them. */
export const TIP_CATEGORIES: readonly TipCategory[] = ['objective', 'jungle', 'kill', 'mental', 'level', 'recall', 'farm', 'ward', 'gold', 'map']

/**
 * Seconds a category stays quiet after one of its tips left the screen, so
 * one kind of news never takes the screen over. Kill, ward and mental are
 * ABSOL's (1 s, 5 s, 5 s); the others are ours, longer where a second tip of
 * the kind would say the same thing again.
 */
export const CATEGORY_COOLDOWNS: Record<TipCategory, number> = {
  objective: 1,
  jungle: 8,
  kill: 1,
  mental: 5,
  level: 3,
  recall: 10,
  farm: 5,
  ward: 5,
  gold: 10,
  map: 5,
}

/** Each category's icon. Named here, in a scanned file, so the icon bundle has them. */
export const CATEGORY_ICONS: Record<TipCategory, string> = {
  objective: 'i-lucide-timer',
  jungle: 'i-lucide-trees',
  kill: 'i-lucide-swords',
  mental: 'i-lucide-brain',
  level: 'i-lucide-chevrons-up',
  recall: 'i-lucide-house',
  farm: 'i-lucide-wheat',
  ward: 'i-lucide-eye',
  gold: 'i-lucide-coins',
  map: 'i-lucide-map',
}

/** A tip's key: a whole line of `VOICE_KEYS`, never a part of one. */
export type TipKey = Exclude<(typeof VOICE_KEYS)[number], { part: true }>['key']

interface TipRule {
  category: TipCategory
  /** Higher first; first come, first shown within one. */
  priority: number
  /** Seconds a tip waits in the queue before it is stale and dropped. */
  ttl: number
}

const rule = (category: TipCategory, priority: number, ttl: number): TipRule => ({ category, priority, ttl })
// A countdown goes stale with the clock: a minute's warning shown 20 s late says the wrong thing.
const minute = rule('objective', 4, 8)
const halfMinute = rule('objective', 5, 8)
const smite = rule('objective', 5, 5)

export const TIP_RULES: Record<TipKey, TipRule> = {
  'objective.dragon.60s': minute,
  'objective.dragon.30s': halfMinute,
  'objective.dragon.smite': smite,
  'objective.elder.60s': minute,
  'objective.elder.30s': halfMinute,
  'objective.elder.smite': smite,
  'objective.grubs.60s': minute,
  'objective.grubs.30s': halfMinute,
  'objective.herald.60s': minute,
  'objective.herald.30s': halfMinute,
  'objective.herald.smite': smite,
  'objective.baron.60s': minute,
  'objective.baron.30s': halfMinute,
  'objective.baron.smite': smite,
  'jungle.spotted': rule('jungle', 4, 8),
  'jungle.firstClear': rule('jungle', 4, 15),
  'jungle.gankWindow': rule('jungle', 4, 15),
  'kill.levelTwo': rule('kill', 3, 10),
  'kill.shutdown': rule('kill', 3, 10),
  'death.streak': rule('mental', 3, 30),
  'death.nemesis': rule('mental', 3, 30),
  'level.sixFirst': rule('level', 3, 15),
  'level.enemySixFirst': rule('level', 3, 15),
  'recall.earlyGold': rule('recall', 3, 20),
  'farm.great': rule('farm', 2, 30),
  'farm.ok': rule('farm', 2, 30),
  'farm.low': rule('farm', 2, 30),
  'ward.redLens': rule('ward', 2, 30),
  'ward.blueLens': rule('ward', 2, 30),
  'gold.ahead': rule('gold', 2, 30),
  'gold.behind': rule('gold', 2, 30),
  'map.minimap': rule('map', 1, 10),
}

export const TIP_KEYS = Object.keys(TIP_RULES) as TipKey[]

/** What a tip's text and voice name: a champion (`champion` as the game writes it, `alias` as Riot files it), a number. */
export type TipParams = Record<string, string | number>

export interface Tip extends TipRule {
  key: TipKey
  params: TipParams
}

export const makeTip = (key: TipKey, params: TipParams = {}): Tip => ({ key, ...TIP_RULES[key], params })

/** Made-up names and numbers for a tip shown without a game: the preview, the settings' test, a dev query. */
export const SAMPLE_PARAMS: TipParams = { champion: 'Lee Sin', alias: 'LeeSin', deaths: 3, csPerMin: 7.4, minute: 10, gold: 1450 }

/** The tip the preview shows under the objectives strip: the sample game's next drake (`overlay-sample.ts`). */
export const SAMPLE_TIP: Tip = makeTip('objective.dragon.30s', { ...SAMPLE_PARAMS, drake: 'ocean' })
