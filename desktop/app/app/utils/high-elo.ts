/** The shapes of the shell's high-elo collector (`src-tauri/src/highelo.rs`, `highelo_data.rs`). */
export interface Tally {
  id: number
  games: number
  wins: number
}

export interface SpellPair {
  spells: [number, number]
  games: number
  wins: number
}

export interface RunePage {
  keystone: number
  primary: number
  secondary: number
  /** The primary tree's four, the keystone first, then the secondary's two. */
  runes: number[]
  games: number
  wins: number
}

export interface ChampionStats {
  championId: number
  patch: string
  patches: string[]
  games: number
  wins: number
  positions: Tally[]
  keystones: Tally[]
  runes: Tally[]
  shards: Tally[]
  pages: RunePage[]
  items: Tally[]
  spells: SpellPair[]
}

export type Phase = '' | 'ladder' | 'players' | 'matches' | 'done' | 'stopped' | 'failed'

export interface Progress {
  running: boolean
  phase: Phase
  platform: string
  playersTotal: number
  playersDone: number
  matchesStored: number
  matchesQueued: number
  rowsStored: number
  calls: number
  gapMs: number
  error: string | null
}

export type Tiers = 'challenger' | 'challenger-grandmaster'

export interface Plan {
  platform: string
  tiers: Tiers
  players: number
  gamesPerPlayer: number
}

/** The lanes' codes in `ChampionStats.positions`, as the Match-V5 `teamPosition` they stand for. */
export const POSITION_BY_CODE: Record<number, string> = { 1: 'TOP', 2: 'JUNGLE', 3: 'MIDDLE', 4: 'BOTTOM', 5: 'UTILITY' }

export const winRate = (tally: { games: number, wins: number }) => (tally.games > 0 ? tally.wins / tally.games : 0)

/** Below this many games a percentage is noise: the page says so rather than hide the numbers. */
export const THIN_SAMPLE = 30

/** The most calls a plan can spend: one ladder call per tier, one id list per player, one match per game, none of them shared. */
export function maxCalls(plan: Pick<Plan, 'players' | 'gamesPerPlayer'>): number {
  return plan.players * (1 + plan.gamesPerPlayer)
}

/** How long that takes at one call every `gapMs`, as a person says it. Matches are shared between players, so the real time is shorter. */
export function estimate(calls: number, gapMs: number): { hours: number, minutes: number } {
  const minutes = Math.ceil((calls * gapMs) / 60000)
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 }
}
