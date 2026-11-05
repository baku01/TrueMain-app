import type { MatchDetailParticipant, MatchDetailResponse } from '#shared/types/match-detail'
import { gradeDetail } from '~/utils/match-summary'
import { matchEvents, readMatch, teamsOf } from '~/utils/blitz/player'

/**
 * Any game Blitz keeps (`BR1_123`), in the shape the shared match detail panel
 * reads: the scoreboard from the match (Riot's match-v5), the purchases and
 * skill points from its timeline (unless `withEvents` is off), the ten
 * players graded as the client's own games are (`gradeDetail`). No rank and no lane at fifteen: Blitz's match
 * carries neither.
 */
export async function blitzMatchDetail(matchId: string, withEvents = true): Promise<MatchDetailResponse | null> {
  const [answer, events] = await Promise.all([
    readMatch(matchId),
    // The timeline is heavy: a list of games reads the scoreboards alone.
    withEvents ? matchEvents(matchId.split('_')[0] ?? '', matchId.split('_')[1] ?? '').catch(() => []) : [],
  ])
  const info = answer.info
  if (!info) return null
  const minutes = Math.max(1, info.gameDuration / 60)
  const byParticipant = new Map(events.map(entry => [entry.participantId, entry]))
  const teamKills = new Map<number, number>()
  for (const participant of info.participants) teamKills.set(participant.teamId, (teamKills.get(participant.teamId) ?? 0) + participant.kills)

  const participants = info.participants.map((p): MatchDetailParticipant => {
    const [primary, secondary] = p.perks?.styles ?? []
    const cs = (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0)
    const kills = teamKills.get(p.teamId) ?? 0
    const found = byParticipant.get(p.participantId)
    return {
      participantId: p.participantId,
      championId: p.championId,
      champLevel: p.champLevel ?? 0,
      summonerName: p.summonerName ?? p.riotIdGameName ?? '',
      gameName: p.riotIdGameName ?? null,
      tagLine: p.riotIdTagline ?? null,
      teamId: p.teamId,
      teamPosition: p.teamPosition,
      win: p.win,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5],
      trinketItemId: p.item6,
      roleBoundItemId: p.roleBoundItem ?? 0,
      summoner1Id: p.summoner1Id,
      summoner2Id: p.summoner2Id,
      primaryStyleId: primary?.style ?? 0,
      subStyleId: secondary?.style ?? 0,
      keystoneId: primary?.selections[0]?.perk ?? 0,
      totalDamageDealtToChampions: p.totalDamageDealtToChampions ?? 0,
      visionScore: p.visionScore ?? 0,
      goldEarned: p.goldEarned ?? 0,
      cs,
      rank: null,
      killParticipation: kills ? (p.kills + p.assists) / kills : 0,
      csPerMin: cs / minutes,
      damagePerMin: (p.totalDamageDealtToChampions ?? 0) / minutes,
      goldPerMin: (p.goldEarned ?? 0) / minutes,
      visionPerMin: (p.visionScore ?? 0) / minutes,
      performanceScore: 0,
      placement: 0,
      isMvp: false,
      isAce: false,
      laning15: null,
      firstToLevelTwo: null,
      runes: [primary, secondary].flatMap(style => (style?.selections ?? []).map((selection, index) => ({ styleId: style!.style, selectionIndex: index, perkId: selection.perk }))),
      statPerkOffense: p.perks?.statPerks?.offense ?? 0,
      statPerkFlex: p.perks?.statPerks?.flex ?? 0,
      statPerkDefense: p.perks?.statPerks?.defense ?? 0,
      itemEvents: found?.itemEvents ?? [],
      skillEvents: found?.skillEvents ?? [],
    }
  })
  return gradeDetail({
    matchId,
    queueId: info.queueId,
    gameMode: info.gameMode ?? 'CLASSIC',
    gameStartTimeUtc: new Date(info.gameCreation).toISOString(),
    gameDurationSeconds: info.gameDuration,
    gameVersion: info.gameVersion,
    participants,
    teams: teamsOf(info.teams),
  })
}
