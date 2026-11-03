import type { CompositionBuildGamesResponse, CompositionBuildRequest, CompositionBuildResponse, CompositionGame } from '#shared/types/composition'
import type { MatchSummaryResponse } from '#shared/types/matches'
import type { ProMatch } from '~/utils/blitz/pro'
import type { Provider } from '~/utils/sources'
import { blitzMatchDetail } from '~/utils/blitz/match-detail'
import { readProMatches } from '~/utils/blitz/pro'
import { championTraits, currentPatch, liveItems } from '~/utils/sources/champions'
import { draftBuildFromOptions, enemySituation, proShares } from '~/utils/draft-build'

/**
 * The matchup tool's two reads (`POST /champions/{id}/composition-build` and
 * its `/games`) when Settings picked another source. TrueMain weighs games by
 * how close their draft is to the one asked; no other source does, so:
 *
 * - the recommendation is built the way the draft's is (`utils/draft-build.ts`):
 *   the source's measured options on the lane, read against the enemy team
 *   on the board (Riot's champion data) and weighted by what the pros finish
 *   in their latest games there, the ones against this opponent counting
 *   twice — with the matchup's games and win rate from the source's
 *   matchups. A source with no options to read falls back to its lane build;
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
  const fromDraft = await draftRecommendation(provider, championId, body, opponent).catch(() => null)
  if (fromDraft) {
    const games = versus?.games ?? fromDraft.gamesConsidered
    return {
      championId,
      position: body.position,
      patch: answer.patch && answer.patch.split('.').length >= 3 ? answer.patch : await currentPatch(),
      eloBracket: body.eloBracket ?? 'ALL',
      matchupRequested: opponent !== null,
      matchupFound: true,
      confidence: { sampleSize: games, candidatePoolSize: games, truemainGameCount: 0, maxPossibleScore: 0, meanSimilarity: 0 },
      lane: {
        measuredGames: versus?.decidedLaneGames ?? 0,
        decidedGames: versus?.decidedLaneGames ?? 0,
        winRate: versus?.laneWinRate ?? null,
        averageGoldDiffAt15: versus?.averageGoldDiffAt15 ?? null,
        averageXpDiffAt15: versus?.averageXpDiffAt15 ?? null,
      },
      build: { ...fromDraft, buildTree: answer.builds[0]?.buildTree ?? [] },
    } as CompositionBuildResponse
  }
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

/**
 * The draft's build for the matchup board: the source's options read against
 * the enemy team and the pros, as the recommendation's build. Null when the
 * source has no options to read.
 */
async function draftRecommendation(provider: Provider, championId: number, body: CompositionBuildRequest, opponent: number | null): Promise<Omit<CompositionBuildResponse['build'], 'buildTree'> | null> {
  const [options, traits, items, pros] = await Promise.all([
    provider.options(championId, body.position, opponent),
    championTraits(),
    liveItems(),
    readProMatches(championId, body.position).catch(() => []),
  ])
  if (!options) return null
  const steps = draftBuildFromOptions(options, enemySituation(body.enemies.map(enemy => enemy.championId), traits, opponent), items, proShares(pros, opponent, items))
  if (!steps.length) return null
  const measured = (list: { itemIds: number[], games: number, pickRate: number, winRate: number }[], itemId: number) =>
    list.find(option => option.itemIds.includes(itemId)) ?? null
  const boots = steps.find(step => step.isBoots)
  const path = steps.filter(step => !step.isBoots).map(step => step.itemId)
  const core = options.cores.find(option => path.slice(0, 2).every(id => option.itemIds.includes(id))) ?? options.cores[0] ?? null
  const bootsOption = boots ? measured(options.boots, boots.itemId) : null
  const page = options.pages[0] ?? null
  const spells = options.spells[0] ?? null
  const skill = options.skills[0] ?? null
  const starter = options.starters[0] ?? null
  return {
    gamesConsidered: core?.games ?? options.games,
    wins: core ? Math.round(core.games * core.winRate) : 0,
    runePage: page ? { ...page.page, games: page.games, pickRate: page.pickRate, winRate: page.winRate } : null,
    starterItems: starter ? { itemIds: starter.itemIds, games: starter.games, pickRate: starter.pickRate, winRate: starter.winRate } : null,
    boots: boots ? { itemIds: [boots.itemId], games: bootsOption?.games ?? boots.games, pickRate: bootsOption?.pickRate ?? 0, winRate: bootsOption?.winRate ?? 0 } : null,
    corePath: { itemIds: path, games: core?.games ?? 0, pickRate: core?.pickRate ?? 0, winRate: core?.winRate ?? 0 },
    summonerSpells: spells && spells.spellIds.length >= 2 ? { spell1Id: spells.spellIds[0]!, spell2Id: spells.spellIds[1]!, games: spells.games, pickRate: spells.pickRate, winRate: spells.winRate } : null,
    skillOrder: skill ? { sequence: skill.order, games: skill.games, pickRate: skill.pickRate, winRate: skill.winRate } : null,
    firstItemId: path[0] ?? 0,
  }
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
