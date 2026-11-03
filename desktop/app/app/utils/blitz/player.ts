import type { ProMatch } from '~/utils/blitz/pro'
import { blitzGet } from '~/utils/blitz/client'
import { keepBounded } from '~/utils/bounded'

/**
 * One player, read from Blitz by Riot ID — no Riot API key: the account and
 * its ranks (`riot_account`), its recent match ids (`match_list`), and each
 * match (`match`, Riot's match-v5 shape) with its timeline (`timeline`), where
 * the skills levelled and the items bought are, in order. A game is read into
 * the same shape as a pro's (`ProMatch`), so every build view draws it.
 */

/** A region as the sources write it (`euw`, `KR`, `na1`) to Riot's platform id (`EUW1`, `KR`, `NA1`). */
const PLATFORMS: Record<string, string> = {
  br: 'BR1', eune: 'EUN1', euw: 'EUW1', jp: 'JP1', kr: 'KR', lan: 'LA1', las: 'LA2', me: 'ME1', na: 'NA1',
  oce: 'OC1', ph: 'PH2', ru: 'RU', sg: 'SG2', th: 'TH2', tr: 'TR1', tw: 'TW2', vn: 'VN2',
}
export const PLAYER_REGIONS = Object.keys(PLATFORMS)

export function platformOf(region: string): string {
  const lower = region.toLowerCase()
  return PLATFORMS[lower] ?? PLATFORMS[lower.replace(/\d+$/, '')] ?? region.toUpperCase()
}

/** A platform id (`BR1`, `KR`) back to the region key the searches use (`br`, `kr`). */
export function regionOfPlatform(platformId: string): string | null {
  const upper = platformId.toUpperCase()
  return Object.entries(PLATFORMS).find(([, id]) => id === upper)?.[0] ?? null
}

/** `Name#TAG` into its two halves; null without a tag. */
export function splitRiotId(riotId: string): { gameName: string, tagLine: string } | null {
  const at = riotId.lastIndexOf('#')
  if (at <= 0 || at === riotId.length - 1) return null
  return { gameName: riotId.slice(0, at).trim(), tagLine: riotId.slice(at + 1).trim() }
}

export interface PlayerLeague { queue: string, tier: string, rank: string, leaguePoints: number, wins: number, losses: number }
export interface PlayerAccount { gameName: string, tagLine: string, puuid: string, leagues: PlayerLeague[], level: number | null, profileIconId: number | null }

interface AccountAnswer {
  account?: { game_name: string, tag_line: string, puuid: string }
  summoner?: { profile_icon_id?: number, summoner_level?: number }
  league_lol?: { queue_type: string, tier: string, rank: string, league_points: number, wins: number, losses: number }[]
}

const path = (platform: string, gameName: string, tagLine: string) =>
  `${platform}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`

export async function readPlayerAccount(region: string, gameName: string, tagLine: string): Promise<PlayerAccount | null> {
  const answer = await blitzGet<AccountAnswer>('lol', `riot_account/lol/${path(platformOf(region), gameName, tagLine)}`)
  if (!answer.account) return null
  return {
    gameName: answer.account.game_name,
    tagLine: answer.account.tag_line,
    puuid: answer.account.puuid,
    level: answer.summoner?.summoner_level ?? null,
    profileIconId: answer.summoner?.profile_icon_id ?? null,
    // Solo/Duo and Flex: the other queues Riot ranks (Arena, a premade test queue) are not what a player is read by.
    leagues: (answer.league_lol ?? []).filter(league => league.queue_type === 'RANKED_SOLO_5x5' || league.queue_type === 'RANKED_FLEX_SR').map(league => ({
      queue: league.queue_type, tier: league.tier, rank: league.rank, leaguePoints: league.league_points, wins: league.wins, losses: league.losses,
    })),
  }
}

/** The player's recent match ids, newest first. */
export async function readPlayerMatchIds(region: string, gameName: string, tagLine: string): Promise<string[]> {
  const answer = await blitzGet<Record<string, unknown>>('lol', `lol/match_list/${path(platformOf(region), gameName, tagLine)}`)
  return Object.keys(answer ?? {}).sort((a, b) => Number(b.split('_')[1]) - Number(a.split('_')[1]))
}

/** One region per routing cluster: a match list read through any of them holds the player's games, prefixed by their own platform. */
const CLUSTER_REGIONS = ['na', 'euw', 'kr', 'oce']

/**
 * The region a player plays on. A Riot ID is global, so the account answers
 * from any region; the games do not — each id carries its platform (`BR1_…`).
 * Null when no cluster lists a game.
 */
export async function homeRegionOf(gameName: string, tagLine: string): Promise<string | null> {
  const lists = await Promise.all(CLUSTER_REGIONS.map(region => readPlayerMatchIds(region, gameName, tagLine).catch(() => [])))
  const platform = lists.find(ids => ids.length)?.[0]?.split('_')[0]
  if (!platform) return null
  return Object.entries(PLATFORMS).find(([, id]) => id === platform)?.[0] ?? null
}

export interface Participant {
  puuid: string
  riotIdGameName?: string
  riotIdTagline?: string
  championId: number
  teamId: number
  teamPosition: string
  participantId: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  summoner1Id: number
  summoner2Id: number
  item0: number, item1: number, item2: number, item3: number, item4: number, item5: number, item6: number
  champLevel?: number
  summonerName?: string
  totalDamageDealtToChampions?: number
  visionScore?: number
  goldEarned?: number
  totalMinionsKilled?: number
  neutralMinionsKilled?: number
  roleBoundItem?: number
  largestMultiKill?: number
  damageDealtToObjectives?: number
  timeCCingOthers?: number
  gameEndedInEarlySurrender?: boolean
  totalTimeSpentDead?: number
  wardsPlaced?: number
  wardsKilled?: number
  visionWardsBoughtInGame?: number
  firstBloodKill?: boolean
  firstBloodAssist?: boolean
  pentaKills?: number
  quadraKills?: number
  tripleKills?: number
  doubleKills?: number
  /** Riot's per-game challenges: rates and counts the scoreboard does not carry. */
  challenges?: Record<string, number>
  perks?: { statPerks?: { offense: number, flex: number, defense: number }, styles?: { style: number, selections: { perk: number }[] }[] }
}

export interface MatchAnswer {
  metadata?: { matchId: string }
  info?: { gameCreation: number, gameDuration: number, gameVersion: string, queueId: number, gameMode?: string, mapId?: number, platformId: string, participants: Participant[] }
}

interface TimelineAnswer {
  info?: { frames: { events: { type: string, participantId?: number, skillSlot?: number, itemId?: number, timestamp: number }[] }[] }
}

const matches = new Map<string, Promise<MatchAnswer>>()
/** A match by id (`BR1_123`), Riot's match-v5 shape, kept for the session. */
export const readMatch = (id: string) => {
  let answer = matches.get(id)
  if (!answer) {
    answer = blitzGet<MatchAnswer>('lol', `lol/match/${id}`)
    answer.catch(() => matches.delete(id))
    keepBounded(matches, id, answer, 120)
  }
  return answer
}

/** The order of a game: the skills levelled and the items bought, from its timeline (heavy: read when a game is opened). */
export async function orderOf(id: string, participantId: number): Promise<{ skillOrder: number[], buildPath: { itemId: number, at: number }[] }> {
  const timeline = await blitzGet<TimelineAnswer>('lol', `lol/timeline/${id}`).catch(() => null)
  const events = (timeline?.info?.frames ?? []).flatMap(frame => frame.events).filter(event => event.participantId === participantId)
  return {
    skillOrder: events.filter(event => event.type === 'SKILL_LEVEL_UP' && event.skillSlot).map(event => event.skillSlot!),
    buildPath: events.filter(event => event.type === 'ITEM_PURCHASED' && event.itemId).map(event => ({ itemId: event.itemId!, at: Math.round(event.timestamp / 1000) })),
  }
}

/**
 * One game of the player as a pro's game is drawn: result, KDA, the items it
 * ended with — and, with `withOrder`, the order it got there (its timeline).
 */
export async function playerGame(id: string, puuid: string, player: { name: string, portraitUrl?: string | null, region: string }, withOrder = true): Promise<(ProMatch & { participantId: number }) | null> {
  const answer = await readMatch(id)
  const info = answer.info
  const me = info?.participants.find(participant => participant.puuid === puuid)
  if (!info || !me) return null
  const opponent = info.participants.find(participant => participant.teamId !== me.teamId && participant.teamPosition === me.teamPosition && me.teamPosition)
  const [primary, secondary] = me.perks?.styles ?? []
  const order = withOrder ? await orderOf(id, me.participantId) : { skillOrder: [], buildPath: [] }
  return {
    matchId: id,
    player: { id: 0, name: player.name, portraitUrl: player.portraitUrl ?? null, riotId: `${me.riotIdGameName ?? ''}#${me.riotIdTagline ?? ''}` },
    team: null,
    region: player.region.toUpperCase(),
    patch: info.gameVersion.split('.').slice(0, 2).join('.'),
    playedAt: info.gameCreation,
    durationSeconds: info.gameDuration,
    championId: me.championId,
    opponentChampionId: opponent?.championId ?? null,
    position: me.teamPosition,
    win: me.win,
    kills: me.kills,
    deaths: me.deaths,
    assists: me.assists,
    items: [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5, me.item6],
    keystoneId: primary?.selections[0]?.perk ?? null,
    runes: [...(primary?.selections ?? []), ...(secondary?.selections ?? [])].map(selection => selection.perk),
    primaryTreeId: primary?.style ?? 0,
    secondaryTreeId: secondary?.style ?? 0,
    // Blitz's pros list the shards defense, flex, offense: the same order here, so `proBuildOption` reads both alike.
    shards: me.perks?.statPerks ? [me.perks.statPerks.defense, me.perks.statPerks.flex, me.perks.statPerks.offense] : [],
    spells: [me.summoner1Id, me.summoner2Id],
    buildPath: order.buildPath,
    skillOrder: order.skillOrder,
    participantId: me.participantId,
  }
}

/**
 * The player's most recent game on a champion, looking through their last
 * `scan` matches a few at a time; null when none of them is on it.
 */
export async function lastGameOn(
  player: { name: string, region: string, portraitUrl?: string | null },
  championId: number,
  scan = 20,
): Promise<ProMatch | null> {
  const riotId = splitRiotId(player.name)
  if (!riotId) return null
  const account = await readPlayerAccount(player.region, riotId.gameName, riotId.tagLine)
  if (!account) return null
  const ids = (await readPlayerMatchIds(player.region, riotId.gameName, riotId.tagLine)).slice(0, scan)
  for (let start = 0; start < ids.length; start += 5) {
    const batch = await Promise.all(ids.slice(start, start + 5).map(id => readMatch(id).then(answer => ({ id, answer })).catch(() => null)))
    const hit = batch.find(entry => entry?.answer.info?.participants.some(participant => participant.puuid === account.puuid && participant.championId === championId))
    if (hit) return await playerGame(hit.id, account.puuid, player)
  }
  return null
}

export interface ParticipantEvents {
  participantId: number
  itemEvents: { timestampMs: number, eventType: string, itemId: number, beforeId: number | null, afterId: number | null }[]
  skillEvents: { timestampMs: number, skillSlot: number }[]
}

interface TimelineEvent { type: string, participantId?: number, timestamp: number, itemId?: number, beforeId?: number, afterId?: number, skillSlot?: number, levelUpType?: string }

const ITEM_EVENTS = new Set(['ITEM_PURCHASED', 'ITEM_SOLD', 'ITEM_DESTROYED', 'ITEM_UNDO'])

/**
 * Every participant's purchases and skill points in a game, from its timeline
 * on Blitz — what the match detail's build order reads, no Riot key needed.
 * An undo carries the item it took back (`beforeId`) and the one it restored.
 */
export async function matchEvents(platformId: string, gameId: string | number): Promise<ParticipantEvents[]> {
  const timeline = await blitzGet<{ info?: { frames: { events: TimelineEvent[] }[] } }>('lol', `lol/timeline/${platformId.toUpperCase()}_${gameId}`)
  const byParticipant = new Map<number, ParticipantEvents>()
  const of = (id: number) => {
    let entry = byParticipant.get(id)
    if (!entry) byParticipant.set(id, entry = { participantId: id, itemEvents: [], skillEvents: [] })
    return entry
  }
  for (const event of (timeline.info?.frames ?? []).flatMap(frame => frame.events)) {
    if (!event.participantId) continue
    if (ITEM_EVENTS.has(event.type)) {
      of(event.participantId).itemEvents.push({
        timestampMs: event.timestamp,
        eventType: event.type,
        itemId: event.itemId ?? event.beforeId ?? 0,
        beforeId: event.type === 'ITEM_UNDO' ? event.beforeId ?? null : null,
        afterId: event.type === 'ITEM_UNDO' ? event.afterId ?? null : null,
      })
    }
    else if (event.type === 'SKILL_LEVEL_UP' && event.skillSlot && event.levelUpType !== 'EVOLVE') {
      of(event.participantId).skillEvents.push({ timestampMs: event.timestamp, skillSlot: event.skillSlot })
    }
  }
  return [...byParticipant.values()]
}
