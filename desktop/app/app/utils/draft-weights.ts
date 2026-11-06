/**
 * The pick suggestions' weights, as Blitz lets the player tune them
 * ("Suggestion Weights", its champion select): four categories — the
 * champion's strength in the meta, how it fares against the lane opponent,
 * how it fits the team, and the player's own comfort on it — that always
 * total 100%, seven presets, and a floor on the player's mastery relative to
 * their top champion. The values are Blitz's own (its renderer, node 172), so
 * a preset ranks the way it does there.
 *
 * Each category is read 0–1, 0.5 when nothing is known of it, the way Blitz
 * reads them: a win rate pulled toward an even one by its games, then placed
 * between 40% and 60%; the tier as a step from D to S; comfort as the mean of
 * how familiar the champion is (mastery, games, how recently) and how the
 * player wins on it against what the lane expects. A suggestion's total is
 * each category times its weight, summed — what the card's breakdown shows.
 *
 * Blitz splits its counter category between the matchup's game and lane win
 * rates; the sources' draft answers carry the game's only, so the split is
 * not offered.
 */

export const WEIGHT_KEYS = ['meta', 'counter', 'teamFit', 'comfort'] as const
export type WeightKey = typeof WEIGHT_KEYS[number]
export type SuggestionWeights = Record<WeightKey, number>

/** Blitz's default mix ("Balanced"): its four signals weighed 0.75, 1.2, 0.4 and 1, over their sum. */
export const BALANCED: SuggestionWeights = { meta: 0.75 / 3.35, counter: 1.2 / 3.35, teamFit: 0.4 / 3.35, comfort: 1 / 3.35 }

/** The mastery floors offered, in percent of the player's top champion's mastery level. */
export const MASTERY_STEPS = [0, 10, 25, 50, 75, 90] as const

export const PRESET_KEYS = ['balanced', 'one-trick', 'meta-follower', 'hard-counter', 'lane-bully', 'team-player', 'climber'] as const
export type PresetKey = typeof PRESET_KEYS[number]

export interface WeightSettings {
  weights: SuggestionWeights
  /** 0–100: a pick needs at least this share of the top champion's mastery level. */
  minMastery: number
}

/** Blitz's presets, value for value. */
export const PRESETS: Record<PresetKey, WeightSettings> = {
  'balanced': { weights: BALANCED, minMastery: 0 },
  'one-trick': { weights: { meta: 0.1, counter: 0.1, teamFit: 0.05, comfort: 0.75 }, minMastery: 75 },
  'meta-follower': { weights: { meta: 0.7, counter: 0.15, teamFit: 0.15, comfort: 0 }, minMastery: 0 },
  'hard-counter': { weights: { meta: 0.15, counter: 0.7, teamFit: 0.05, comfort: 0.1 }, minMastery: 0 },
  'lane-bully': { weights: { meta: 0.2, counter: 0.55, teamFit: 0.05, comfort: 0.2 }, minMastery: 0 },
  'team-player': { weights: { meta: 0.2, counter: 0.15, teamFit: 0.5, comfort: 0.15 }, minMastery: 0 },
  'climber': { weights: { meta: 0.4, counter: 0.15, teamFit: 0.05, comfort: 0.4 }, minMastery: 25 },
}

export const DEFAULT_SETTINGS: WeightSettings = { weights: { ...BALANCED }, minMastery: 0 }

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** The weights as shares of their sum; anything unusable (negative, missing, all zero) falls back to Balanced. */
export function normalized(weights: Partial<Record<WeightKey, unknown>>): SuggestionWeights {
  let values = WEIGHT_KEYS.map(key => (finite(weights[key]) ? Math.max(weights[key] as number, 0) : BALANCED[key]))
  let sum = values.reduce((total, value) => total + value, 0)
  if (sum <= 0) {
    values = WEIGHT_KEYS.map(key => BALANCED[key])
    sum = 1
  }
  return Object.fromEntries(WEIGHT_KEYS.map((key, index) => [key, values[index]! / sum])) as SuggestionWeights
}

/** A mastery floor kept to a whole percent, 0–100. */
export const masteryFloor = (value: unknown) => (finite(value) ? Math.min(Math.max(Math.round(value), 0), 100) : 0)

/** Settings read back from storage: whatever it held, made usable. */
export function settingsOf(raw: unknown): WeightSettings {
  const stored = raw && typeof raw === 'object' ? raw as Partial<WeightSettings> : {}
  return { weights: normalized(stored.weights ?? {}), minMastery: masteryFloor(stored.minMastery) }
}

/**
 * One category set to `value`, the others rescaled to share what is left in
 * the proportions they had, so the four still total 100% — Blitz's slider.
 * When the others were all zero, they share it evenly.
 */
export function rebalanced(weights: SuggestionWeights, key: WeightKey, value: number): SuggestionWeights {
  const current = normalized(weights)
  const set = clamp01(value)
  const others = WEIGHT_KEYS.filter(other => other !== key)
  const rest = others.reduce((total, other) => total + current[other], 0)
  const next = { ...current, [key]: set }
  for (const other of others) next[other] = rest > 0 ? (current[other] / rest) * (1 - set) : (1 - set) / others.length
  return next
}

/** The preset these settings are, within half a point on every weight; null for a mix of the player's own. */
export function presetOf(settings: WeightSettings): PresetKey | null {
  const weights = normalized(settings.weights)
  return PRESET_KEYS.find((key) => {
    const preset = PRESETS[key]
    return preset.minMastery === masteryFloor(settings.minMastery)
      && WEIGHT_KEYS.every(weight => Math.abs(normalized(preset.weights)[weight] - weights[weight]) < 0.005)
  }) ?? null
}

/**
 * Whether a champion clears the mastery floor: its mastery level at least
 * `minMastery` percent of the player's top level. Nothing to compare with (no
 * floor, no mastery read) lets every champion through.
 */
export function clearsMastery(level: number | null | undefined, topLevel: number, minMastery: number): boolean {
  const floor = masteryFloor(minMastery)
  if (!floor || !(topLevel > 0)) return true
  return Math.max(level ?? 0, 0) >= (topLevel * floor) / 100
}

// ─── Each category, 0–1 ─────────────────────────────────────────────────────

/** Unknown is even. */
export const NEUTRAL = 0.5
/** Games that pull a win rate halfway back to even. */
const PRIOR_GAMES = 100

/** 0 at `low`, 1 at `high`, linear between. */
const band = (value: number, low: number, high: number) => (value <= low ? 0 : value >= high ? 1 : (value - low) / (high - low))

/** A win rate pulled toward an even one by how few games it rests on; none at all is even. */
export function shrunkRate(rate: number, games: number): number {
  if (!finite(rate) || !(games > 0)) return NEUTRAL
  return NEUTRAL + (clamp01(rate) - NEUTRAL) * (games / (games + PRIOR_GAMES))
}

/** A win rate placed between 40% (0) and 60% (1). */
export const rateScore = (rate: number) => band(rate, 0.4, 0.6)

/** The tier as a step: S 1, A 0.75, B 0.5, C 0.25, D 0; an unknown tier counts as D, as Blitz counts it. */
export function tierScore(tier: string | null | undefined): number {
  return ({ S: 1, A: 0.75, B: 0.5, C: 0.25 } as Record<string, number>)[(tier ?? '').trim().charAt(0).toUpperCase()] ?? 0
}

export interface ComfortInput {
  /** Mastery points on the champion, when known. */
  points?: number | null
  /** Mastery level, read when there are no points. */
  level?: number | null
  /** Games on the champion among those read, and the wins of them. */
  games?: number | null
  wins?: number | null
  /** Epoch ms of the last game on it. */
  lastPlayedAt?: number | null
  /** What a game on it is expected to win: its lane win rate. */
  expectedWinRate?: number | null
  now?: number
}

const DAY_MS = 86_400_000

/** The mean of what is known, each part with its weight. */
const weighted = (parts: { score: number, weight: number }[]) => {
  const weight = parts.reduce((sum, part) => sum + part.weight, 0)
  return weight ? parts.reduce((sum, part) => sum + clamp01(part.score) * part.weight, 0) / weight : null
}

/**
 * How familiar the champion is to the player, 0–1, null when nothing is
 * known: mastery points on a log scale up to 100,000 (or the level up to 10),
 * games up to twenty on the same scale, and how recently — halved every 90
 * days — weighed 45%, 40% and 15%.
 */
export function familiarity(input: ComfortInput): number | null {
  const parts: { score: number, weight: number }[] = []
  if (finite(input.points) && input.points >= 0) parts.push({ score: Math.log1p(input.points) / Math.log1p(100_000), weight: 0.45 })
  else if (finite(input.level) && input.level > 0) parts.push({ score: band(input.level, 0, 10), weight: 0.45 })
  if (finite(input.games) && input.games >= 0) parts.push({ score: Math.log1p(input.games) / Math.log1p(20), weight: 0.4 })
  if (finite(input.lastPlayedAt) && input.lastPlayedAt > 0) {
    const days = Math.max((input.now ?? Date.now()) - input.lastPlayedAt, 0) / DAY_MS
    parts.push({ score: 2 ** (-days / 90), weight: 0.15 })
  }
  return weighted(parts)
}

/**
 * How the player wins on the champion against what the lane expects, 0–1,
 * null without a game: the wins pulled toward the expected rate by twenty
 * games, five points under it 0, five over it 1.
 */
export function winsOverExpected(input: ComfortInput): number | null {
  const games = input.games
  if (!finite(games) || games <= 0) return null
  const wins = Math.min(Math.max(input.wins ?? 0, 0), games)
  const expected = finite(input.expectedWinRate) ? clamp01(input.expectedWinRate) : NEUTRAL
  return band((wins + 20 * expected) / (games + 20) - expected, -0.05, 0.05)
}

/** The comfort category: familiarity and performance, the mean of the ones known; null when neither is. */
export function comfortScore(input: ComfortInput): number | null {
  return weighted([familiarity(input), winsOverExpected(input)].filter(finite).map(score => ({ score, weight: 1 })))
}

// ─── The total ──────────────────────────────────────────────────────────────

export interface WeightedInput {
  /** The champion's tier on the lane. */
  tier: string | null
  /** Its win rate against the lane opponent minus its own on the lane, and the games. */
  matchupDelta: number
  matchupGames: number
  /** What our allies add to it, as a win-rate difference, and the games. */
  synergyDelta: number
  synergyGames: number
  /** `comfortScore`, null when nothing is known of the player on it. */
  comfort: number | null
}

/** Each category 0–1, and its points: the category times its weight. The total is the points summed. */
export interface WeightedScore {
  total: number
  parts: Record<WeightKey, { value: number, weight: number, points: number }>
}

export function weightedScore(input: WeightedInput, settings: SuggestionWeights): WeightedScore {
  const weights = normalized(settings)
  const values: Record<WeightKey, number> = {
    meta: tierScore(input.tier),
    counter: rateScore(shrunkRate(NEUTRAL + input.matchupDelta, input.matchupGames)),
    teamFit: rateScore(shrunkRate(NEUTRAL + input.synergyDelta, input.synergyGames)),
    comfort: input.comfort ?? NEUTRAL,
  }
  const parts = Object.fromEntries(WEIGHT_KEYS.map(key => [key, { value: values[key], weight: weights[key], points: values[key] * weights[key] }])) as WeightedScore['parts']
  return { total: clamp01(WEIGHT_KEYS.reduce((sum, key) => sum + parts[key].points, 0)), parts }
}
