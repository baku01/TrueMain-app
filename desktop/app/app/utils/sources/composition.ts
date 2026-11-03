import type { CompositionBuildGamesResponse, CompositionBuildRequest, CompositionBuildResponse, CompositionGame } from '#shared/types/composition'
import type { MatchSummaryResponse } from '#shared/types/matches'
import type { ProMatch } from '~/utils/blitz/pro'
import type { Provider } from '~/utils/sources'
import { blitzMatchDetail } from '~/utils/blitz/match-detail'
import { readProMatches } from '~/utils/blitz/pro'
import { currentPatch } from '~/utils/sources/champions'

/**
 * The matchup tool's two reads (`POST /champions/{id}/composition-build` and
 * its `/games`) when Settings picked another source. TrueMain weighs games by
 * how close their draft is to the one asked; no other source does, so:
 *
 * - the recommendation is the source's build on the lane — against the lane
 *   opponent when the source measures builds by matchup (Blitz does), the
 *   lane's own otherwise, said as a matchup not found — with the matchup's
 *   games and win rate from the source's matchups;
 * - the games are real games of the matchup the source cannot list itself:
 *   the latest high-elo and pro games Blitz keeps of the champion on the
 *   lane, the ones against that opponent first.
 */
const opponentOf = (body: CompositionBuildRequest) =>
  body.enemies.find(enemy => enemy.position === body.position)?.championId ?? null

export async function compositionFromSource(provider: Provider, championId: number, body: CompositionBuildRequest, measuresMatchups: boolean): Promise<CompositionBuildResponse> {
  const opponent = opponentOf(body)
  const [answer, matchups] = await Promise.all([
    provider.builds(championId, body.position, measuresMatchups ? opponent : null),
    opponent ? provider.matchups(championId, { position: body.position, opponent }).catch(() => null) : null,
  ])
  const versus = matchups?.matchups.find(row => row.opponentChampionId === opponent) ?? null
  const build = answer.builds[0] ?? null
  const games = versus?.games ?? build?.games ?? 0
  return {
    championId,
    position: body.position,
    // Icons are read at this patch: a short one (`16.21`) or none is Data Dragon's full version.
    patch: answer.patch && answer.patch.split('.').length >= 3 ? answer.patch : await currentPatch(),
    eloBracket: body.eloBracket ?? 'ALL',
    matchupRequested: opponent !== null,
    matchupFound: opponent === null || (measuresMatchups && build !== null),
    confidence: { sampleSize: games, candidatePoolSize: games, truemainGameCount: 0, maxPossibleScore: 0, meanSimilarity: 0 },
    lane: {
      measuredGames: versus?.decidedLaneGames ?? 0,
      decidedGames: versus?.decidedLaneGames ?? 0,
      winRate: versus?.laneWinRate ?? null,
      averageGoldDiffAt15: versus?.averageGoldDiffAt15 ?? null,
      averageXpDiffAt15: versus?.averageXpDiffAt15 ?? null,
    },
    build: {
      gamesConsidered: build?.games ?? 0,
      wins: build ? Math.round(build.games * build.winRate) : 0,
      runePage: build?.core.runePage ?? null,
      starterItems: build?.core.starterItems ?? null,
      boots: build?.core.boots ?? null,
      corePath: build?.core.itemPath ?? null,
      summonerSpells: build?.core.summonerSpells ?? null,
      skillOrder: build?.core.skillOrder ?? null,
      firstItemId: build?.firstItemId ?? 0,
      buildTree: build?.buildTree ?? [],
    },
  } as CompositionBuildResponse
}

/** One Blitz game as a match-history row, the pilot's slice of it; null when Blitz no longer has the game. */
async function gameOf(match: ProMatch): Promise<CompositionGame | null> {
  const detail = await blitzMatchDetail(match.matchId, false).catch(() => null)
  const self = detail?.participants.find(p => p.championId === match.championId && p.teamPosition === match.position)
  if (!detail || !self) return null
  const [gameName, tagLine] = (match.player.riotId ?? match.player.name).split('#')
  const summary: MatchSummaryResponse = {
    matchId: match.matchId,
    queueId: detail.queueId,
    gameMode: detail.gameMode,
    gameStartTimeUtc: detail.gameStartTimeUtc,
    gameDurationSeconds: detail.gameDurationSeconds,
    self: {
      championId: self.championId,
      championLevel: self.champLevel,
      summoner1Id: self.summoner1Id,
      summoner2Id: self.summoner2Id,
      primaryStyleId: self.primaryStyleId,
      subStyleId: self.subStyleId,
      keystoneId: self.keystoneId,
      kills: self.kills,
      deaths: self.deaths,
      assists: self.assists,
      cs: self.cs,
      killParticipation: self.killParticipation,
      items: self.items,
      trinketItemId: self.trinketItemId,
      roleBoundItemId: self.roleBoundItemId,
      teamId: self.teamId,
      position: self.teamPosition || null,
      win: self.win,
      lpDelta: null,
      performanceScore: self.performanceScore,
      placement: self.placement,
      isMvp: self.isMvp,
      isAce: self.isAce,
    },
    participants: detail.participants.map(p => ({ championId: p.championId, teamId: p.teamId, position: p.teamPosition || null, gameName: p.gameName, tagLine: p.tagLine })),
  }
  return { score: 0, isTruemain: false, pilot: { gameName: gameName ?? match.player.name, tagLine: tagLine || null, profileIconId: 0 }, match: summary }
}

export async function compositionGamesFromBlitz(championId: number, body: CompositionBuildRequest, page: number, pageSize: number): Promise<CompositionBuildGamesResponse> {
  const opponent = opponentOf(body)
  const matches = await readProMatches(championId, body.position)
  // The matchup's own games first, then the lane's others, newest first within each.
  const ordered = [...matches.filter(match => match.opponentChampionId === opponent), ...matches.filter(match => match.opponentChampionId !== opponent)]
  const slice = ordered.slice((page - 1) * pageSize, page * pageSize)
  const games = (await Promise.all(slice.map(gameOf))).filter((game): game is CompositionGame => game !== null)
  return { championId, position: body.position, patch: matches[0]?.patch ?? null, page, pageSize, total: ordered.length, maxPossibleScore: 0, games }
}
