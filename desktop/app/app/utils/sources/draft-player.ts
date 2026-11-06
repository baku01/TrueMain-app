import type { DataSource } from '~/utils/data-source'
import type { PositionGames } from '~/types/loading'
import type { PlayerGame, RankedQueue } from '~/types/record'
import type { ChampionMastery } from '~/types/lcu'
import type { Obj } from '~/utils/sources/opgg'
import { truemainNameTag } from '#shared/utils/truemain-path'
import { apiGet } from '~/composables/useApi'
import { blitzGet, truemainPosition } from '~/utils/blitz/client'
import { homeRegionOf, platformOf, readChampionMastery, readPlayerAccount, regionOfPlatform, splitRiotId } from '~/utils/blitz/player'
import { keepBounded } from '~/utils/bounded'
import { opggRegion } from '~/utils/sources/opgg-profile'
import { asList, callOpgg, num } from '~/utils/sources/opgg'

/**
 * What the player card in champion select says about one player — their
 * rank, their latest games (the roles they played, the champions, who they
 * queued with) and their mastery on the champion they show — and where each
 * is read. Probed source by source:
 *
 * - their own client (the shell's record: `player_record`, the mastery list):
 *   all three, for the player alone;
 * - TrueMain (`/truemains/{Name-TAG}/profile`): rank, roles and mains, the
 *   mastery points of their signature champion only — for the accounts it
 *   ingests, a 404 for the rest; and only while TrueMain is the source (the
 *   shell refuses it otherwise, `api.rs`);
 * - Blitz: rank (`riot_account`), the latest twenty games' roles, champions
 *   and mates (`lol/playstyles`), mastery levels (`riot_account_v2`);
 * - op.gg (`lol_get_summoner_profile`): rank and the season's most played
 *   champions — no roles, no mates, no mastery;
 * - lolalytics and Tencent: no player reads at all.
 *
 * Each part is read from the picked source when it carries it, else from the
 * first of the others that does, Blitz first; a source that fails or answers
 * nothing passes to the next. Each answer is one source's, named on the card.
 */

export type CardSource = 'client' | 'truemain' | 'blitz' | 'opgg'
export type CardPart = 'rank' | 'history' | 'mastery'

export interface CardRank { tier: string, division: string, leaguePoints: number, wins: number, losses: number }
export interface CardHistory {
  games: number
  /** Null where the source counts no wins. */
  wins: number | null
  /** Role-assigned games by lane, most first. */
  positions: PositionGames[]
  /** Champions played, most first. */
  champions: { championId: number, games: number }[]
  /** Who they queued with lately (`Name#TAG`), and in how many games. */
  mates: { riotId: string, games: number }[]
}
export interface CardMastery { level: number | null, points: number | null }
export interface CardRead<T> { source: CardSource, value: T }

/** What each source carries. */
const CARRIES: Record<CardSource, CardPart[]> = {
  client: ['rank', 'history', 'mastery'],
  truemain: ['rank', 'history', 'mastery'],
  blitz: ['rank', 'history', 'mastery'],
  opgg: ['rank', 'history'],
}

/** The sources a part is asked of, in order, for the player (`isMe`) or someone else. */
export function cardOrder(part: CardPart, picked: DataSource, isMe: boolean): CardSource[] {
  const own: CardSource[] = picked === 'truemain' ? (isMe ? ['client', 'truemain'] : ['truemain']) : picked === 'blitz' || picked === 'opgg' ? [picked] : []
  const fallbacks: CardSource[] = ['blitz', 'opgg', 'client']
  return [...new Set([...own, ...fallbacks])].filter(source =>
    CARRIES[source].includes(part) && (source !== 'client' || isMe) && (source !== 'truemain' || picked === 'truemain'))
}

/** An answer that says nothing passes to the next source. */
const says = (value: unknown) => value !== null && value !== undefined && !(typeof value === 'object' && 'games' in value && !(value as CardHistory).games && !(value as CardHistory).champions.length)

/** The first source of `order` whose read answers something. */
export async function firstRead<T>(order: CardSource[], read: (source: CardSource) => Promise<T | null> | null): Promise<CardRead<T> | null> {
  for (const source of order) {
    try {
      const value = await read(source)
      if (says(value)) return { source, value: value as T }
    }
    catch {
      // The next source.
    }
  }
  return null
}

// ─── The player's own client ────────────────────────────────────────────────

export interface ClientRecord { ranked: RankedQueue[], games: PlayerGame[], mastery: ChampionMastery[] }

const SOLO = 'RANKED_SOLO_5x5'
const rankOf = (queue: RankedQueue | undefined): CardRank | null =>
  queue && queue.tier && queue.tier !== 'NONE' ? { tier: queue.tier, division: queue.division, leaguePoints: queue.leaguePoints, wins: queue.wins, losses: queue.losses } : null

const counted = <K>(keys: K[]) => [...keys.reduce((map, key) => map.set(key, (map.get(key) ?? 0) + 1), new Map<K, number>())].sort((a, b) => b[1] - a[1])

/** The latest twenty games of the client's record, read as a history: their mates are the teammates named in two or more. */
export function clientHistory(games: PlayerGame[]): CardHistory {
  const recent = games.filter(game => !game.remake).slice(0, 20)
  const mates = recent.flatMap(game => game.participants
    .filter(other => other.teamId === game.teamId && other.participantId !== game.participantId && other.gameName && other.tagLine)
    .map(other => `${other.gameName}#${other.tagLine}`))
  return {
    games: recent.length,
    wins: recent.filter(game => game.win).length,
    positions: counted(recent.flatMap(game => (game.position ? [game.position] : []))).map(([position, games]) => ({ position, games })),
    champions: counted(recent.map(game => game.championId)).map(([championId, games]) => ({ championId, games })),
    mates: counted(mates).map(([riotId, games]) => ({ riotId, games })),
  }
}

/** Games two players share among their latest that make them a premade, as `premade.ts` reads it. */
const SHARED_GAMES = 2

/** The teammates of this lobby the player queued with lately: who they are a duo (or a trio) with. */
export function queuedWith(history: CardHistory | null, teammates: string[]): string[] {
  const mates = new Set((history?.mates ?? []).filter(mate => mate.games >= SHARED_GAMES).map(mate => mate.riotId.toLowerCase()))
  return teammates.filter(riotId => mates.has(riotId.toLowerCase()))
}

// ─── Blitz, op.gg, TrueMain ─────────────────────────────────────────────────

interface Playstyles { roles?: Record<string, number>, champion_counts?: Record<string, number>, recently_played_with?: { game_name: string, tag_line: string, games: number }[], wins?: number, total_games?: number }

/** Blitz's twenty latest games of a player, as a history. */
export function blitzHistory(answer: Playstyles): CardHistory {
  return {
    games: answer.total_games ?? 0,
    wins: answer.wins ?? null,
    positions: Object.entries(answer.roles ?? {}).filter(([role]) => role).map(([role, games]) => ({ position: truemainPosition(role.toUpperCase()), games })).sort((a, b) => b.games - a.games),
    champions: Object.entries(answer.champion_counts ?? {}).map(([id, games]) => ({ championId: Number(id), games })).sort((a, b) => b.games - a.games),
    mates: (answer.recently_played_with ?? []).map(mate => ({ riotId: `${mate.game_name}#${mate.tag_line}`, games: mate.games })),
  }
}

interface TruemainProfile {
  ranked?: { tier: string, division: string, leaguePoints: number, wins?: number | null, losses?: number | null } | null
  mains?: { championId: number, games: number }[]
  positions?: { position: string, games: number }[]
  dedication?: { championId: number, masteryPoints?: number | null } | null
}

/** Every read once a session, by source, part and player; a failed one is asked again. */
const reads = new Map<string, Promise<unknown>>()
function once<T>(key: string, read: () => Promise<T>): Promise<T> {
  let answer = reads.get(key) as Promise<T> | undefined
  if (!answer) {
    answer = read()
    answer.catch(() => reads.delete(key))
    keepBounded(reads, key, answer)
  }
  return answer
}

/**
 * The platform a lobby's players are read on: the player's own, from their
 * client's record; else, a Riot ID being global, the one Blitz finds their
 * games on (`homeRegionOf`). Null when neither knows.
 */
export function platformFor(riotId: string, known: string | null): Promise<string | null> {
  if (known) return Promise.resolve(known)
  const id = splitRiotId(riotId)
  if (!id) return Promise.resolve(null)
  return once(`region:${riotId.toLowerCase()}`, () => homeRegionOf(id.gameName, id.tagLine)).then(region => (region ? platformOf(region) : null)).catch(() => null)
}

/** Who is read, where, and what the card shows them on. */
export interface CardSubject { riotId: string, platformId: string, championId: number | null }

function blitzPart(part: CardPart, subject: CardSubject): Promise<unknown> | null {
  const id = splitRiotId(subject.riotId)
  const region = regionOfPlatform(subject.platformId)
  if (!id || !region) return null
  if (part === 'rank') {
    return once(`blitz:account:${subject.platformId}:${subject.riotId}`, () => readPlayerAccount(region, id.gameName, id.tagLine)).then((account) => {
      const solo = account?.leagues.find(league => league.queue === SOLO)
      return solo?.tier ? { tier: solo.tier, division: solo.rank, leaguePoints: solo.leaguePoints, wins: solo.wins, losses: solo.losses } : null
    })
  }
  if (part === 'history') {
    return once(`blitz:playstyles:${subject.platformId}:${subject.riotId}`, () => blitzGet<Playstyles>('lol', `lol/playstyles/${platformOf(region)}/${encodeURIComponent(id.gameName)}/${encodeURIComponent(id.tagLine)}`)).then(blitzHistory)
  }
  return once(`blitz:mastery:${subject.platformId}:${subject.riotId}`, () => readChampionMastery(region, id.gameName, id.tagLine))
    .then(list => list.find(entry => entry.championId === subject.championId))
    .then(entry => (entry ? { level: entry.championLevel, points: null } : null))
}

function opggPart(part: CardPart, subject: CardSubject): Promise<unknown> | null {
  const id = splitRiotId(subject.riotId)
  if (!id || part === 'mastery') return null
  const profile = once(`opgg:${subject.platformId}:${subject.riotId}`, () => callOpgg('lol_get_summoner_profile', {
    game_name: id.gameName,
    tag_line: id.tagLine,
    region: opggRegion(subject.platformId),
    desired_output_fields: ['data.summoner.league_stats[]', 'data.summoner.ranked_most_champions'],
  }).then(root => (root.data as Obj | undefined)?.summoner as Obj | undefined))
  if (part === 'rank') {
    return profile.then((summoner) => {
      const solo = asList(summoner?.league_stats).find(league => league.game_type === 'SOLORANKED')
      const tier = solo?.tier_info as Obj | undefined
      if (!tier?.tier) return null
      return { tier: String(tier.tier).toUpperCase(), division: ['', 'I', 'II', 'III', 'IV'][num(tier.division)] ?? '', leaguePoints: num(tier.lp), wins: num(solo?.win), losses: num(solo?.lose) }
    })
  }
  return profile.then((summoner) => {
    const most = summoner?.ranked_most_champions as Obj | undefined
    const champions = asList(most?.my_champion_stats).map(stat => ({ championId: num(stat.id), games: num(stat.play) })).filter(entry => entry.championId > 0).sort((a, b) => b.games - a.games)
    return { games: num(most?.play), wins: most ? num(most.win) : null, positions: [], champions, mates: [] } satisfies CardHistory
  })
}

function truemainPart(part: CardPart, subject: CardSubject): Promise<unknown> | null {
  const id = splitRiotId(subject.riotId)
  if (!id) return null
  const profile = once(`truemain:${subject.riotId}`, () => apiGet<TruemainProfile>(`/truemains/${encodeURIComponent(truemainNameTag(id.gameName, id.tagLine))}/profile`))
  if (part === 'rank') return profile.then(answer => (answer.ranked?.tier ? { tier: answer.ranked.tier, division: answer.ranked.division, leaguePoints: answer.ranked.leaguePoints, wins: answer.ranked.wins ?? 0, losses: answer.ranked.losses ?? 0 } : null))
  if (part === 'history') {
    return profile.then(answer => ({
      games: (answer.positions ?? []).reduce((sum, entry) => sum + entry.games, 0),
      wins: null,
      positions: [...(answer.positions ?? [])].sort((a, b) => b.games - a.games),
      champions: (answer.mains ?? []).map(main => ({ championId: main.championId, games: main.games })),
      mates: [],
    }))
  }
  return profile.then(answer => (answer.dedication?.championId === subject.championId && answer.dedication.masteryPoints != null ? { level: null, points: answer.dedication.masteryPoints } : null))
}

/** One part of the card, from the first source that answers it. */
export function readCardPart<T>(part: CardPart, subject: CardSubject, picked: DataSource, client: ClientRecord | null): Promise<CardRead<T> | null> {
  return firstRead<T>(cardOrder(part, picked, client !== null), (source) => {
    if (source === 'client') {
      if (!client) return null
      if (part === 'rank') return Promise.resolve(rankOf(client.ranked.find(queue => queue.queueType === SOLO)) as T | null)
      if (part === 'history') return Promise.resolve(clientHistory(client.games) as T)
      const own = client.mastery.find(entry => entry.championId === subject.championId)
      return Promise.resolve((own ? { level: own.championLevel, points: own.championPoints ?? null } : null) as T | null)
    }
    const read = source === 'blitz' ? blitzPart(part, subject) : source === 'opgg' ? opggPart(part, subject) : truemainPart(part, subject)
    return read as Promise<T | null> | null
  })
}
