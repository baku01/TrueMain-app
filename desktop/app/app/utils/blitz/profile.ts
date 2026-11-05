import type { PlayerGame, RankedQueue } from '~/types/record'
import type { MatchAnswer, Participant, PlayerAccount } from '~/utils/blitz/player'
import { readMatch, readPlayerMatchIds, teamsOf } from '~/utils/blitz/player'

/**
 * Any player's record as the dashboard draws one (`PlayerRecord`), read from
 * Blitz — the account, its ranks, and its games from Riot's match data — so
 * a player clicked in a game or found by the search opens on the same page as
 * the player's own profile, which the client reads.
 */

/** The ranks of an account, as the client lists them. */
export function rankedOf(account: PlayerAccount): RankedQueue[] {
  return account.leagues.map(league => ({
    queueType: league.queue,
    tier: league.tier,
    division: league.rank,
    leaguePoints: league.leaguePoints,
    wins: league.wins,
    losses: league.losses,
    isProvisional: false,
    provisionalGamesRemaining: 0,
  }))
}

const csOf = (p: Participant) => (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0)

/** One match as one of the player's games; null when the player is not in it. */
export function gameOf(answer: MatchAnswer, puuid: string): PlayerGame | null {
  const info = answer.info
  const me = info?.participants.find(p => p.puuid === puuid)
  if (!info || !me) return null
  const team = info.participants.filter(p => p.teamId === me.teamId)
  const [primary, secondary] = me.perks?.styles ?? []
  return {
    gameId: Number(answer.metadata?.matchId?.split('_')[1] ?? 0),
    participantId: me.participantId,
    playedAt: info.gameCreation,
    durationSeconds: info.gameDuration,
    queueId: info.queueId,
    mapId: info.mapId ?? 11,
    championId: me.championId,
    championLevel: me.champLevel ?? 0,
    teamId: me.teamId,
    position: me.teamPosition || null,
    win: me.win,
    remake: info.gameDuration < 300 || Boolean(me.gameEndedInEarlySurrender && info.gameDuration < 300),
    kills: me.kills,
    deaths: me.deaths,
    assists: me.assists,
    cs: csOf(me),
    gold: me.goldEarned ?? 0,
    damageToChampions: me.totalDamageDealtToChampions ?? 0,
    visionScore: me.visionScore ?? 0,
    largestMultiKill: me.largestMultiKill ?? 0,
    multiKills: { double: me.doubleKills ?? 0, triple: me.tripleKills ?? 0, quadra: me.quadraKills ?? 0, penta: me.pentaKills ?? 0 },
    firstBlood: Boolean(me.firstBloodKill || me.firstBloodAssist),
    items: [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5],
    trinket: me.item6,
    roleBoundItem: me.roleBoundItem ?? 0,
    spells: [me.summoner1Id, me.summoner2Id],
    keystone: primary?.selections[0]?.perk ?? 0,
    primaryStyle: primary?.style ?? 0,
    subStyle: secondary?.style ?? 0,
    teamKills: team.reduce((sum, p) => sum + p.kills, 0),
    teamDamageToChampions: team.reduce((sum, p) => sum + (p.totalDamageDealtToChampions ?? 0), 0),
    participants: info.participants.map(p => ({
      participantId: p.participantId,
      championId: p.championId,
      teamId: p.teamId,
      position: p.teamPosition || null,
      gameName: p.riotIdGameName ?? null,
      tagLine: p.riotIdTagline ?? null,
      win: p.win,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      cs: csOf(p),
      goldEarned: p.goldEarned ?? 0,
      damageToChampions: p.totalDamageDealtToChampions ?? 0,
      visionScore: p.visionScore ?? 0,
      damageSelfMitigated: p.damageSelfMitigated ?? 0,
      damageToTurrets: p.damageDealtToTurrets ?? 0,
      marks: [],
    })),
    teams: teamsOf(info.teams),
  }
}

/** The player's games `from` to `from + count` of their match list, newest first, a few read at a time. */
export async function readProfileGames(ids: string[], puuid: string, from: number, count: number): Promise<PlayerGame[]> {
  const games: PlayerGame[] = []
  const slice = ids.slice(from, from + count)
  for (let start = 0; start < slice.length; start += 5) {
    const batch = await Promise.all(slice.slice(start, start + 5).map(id => readMatch(id).then(answer => gameOf(answer, puuid)).catch(() => null)))
    games.push(...batch.filter((game): game is PlayerGame => game !== null))
  }
  return games
}

export const profileMatchIds = (region: string, gameName: string, tagLine: string) =>
  readPlayerMatchIds(region, gameName, tagLine)
