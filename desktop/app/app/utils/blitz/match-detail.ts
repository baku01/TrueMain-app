import type { MatchDetailParticipant, MatchDetailResponse } from '#shared/types/match-detail'
import type { WinProbabilityTimeline } from '#shared/types/win-probability'
import type { RiotTimeline, PlayerAccount  } from '~/utils/blitz/player'
import { gradeDetail } from '~/utils/match-summary'
import { matchEvents, readMatch, readPlayerAccount, readTimeline, teamsOf } from '~/utils/blitz/player'
import { keepBounded } from '~/utils/bounded'

const accounts = new Map<string, Promise<PlayerAccount | null>>()
/** A player's account on Blitz by Riot ID, kept for the session: a scoreboard asks for ten at once. */
function accountOf(platformId: string, gameName: string, tagLine: string) {
  const key = `${platformId}/${gameName}#${tagLine}`.toLowerCase()
  let answer = accounts.get(key)
  if (!answer) {
    answer = readPlayerAccount(platformId, gameName, tagLine).catch(() => null)
    keepBounded(accounts, key, answer, 200)
  }
  return answer
}

/**
 * The game's players with their Solo/Duo rank where the detail had none: no
 * source ranks the ten of a game at once, so each is read from Blitz by Riot
 * ID (`riot_account`, ten at once, kept for the session). Their rank today,
 * not at the time of the game; an unranked player, or one renamed since, keeps
 * none.
 */
export async function withRanks(detail: MatchDetailResponse, platformId: string): Promise<MatchDetailResponse> {
  if (detail.participants.every(p => p.rank || !p.gameName || !p.tagLine)) return detail
  const participants = await Promise.all(detail.participants.map(async (p) => {
    if (p.rank || !p.gameName || !p.tagLine) return p
    const solo = (await accountOf(platformId, p.gameName, p.tagLine))?.leagues.find(league => league.queue === 'RANKED_SOLO_5x5')
    return solo ? { ...p, rank: { tier: solo.tier, division: solo.rank, leaguePoints: solo.leaguePoints } } : p
  }))
  return { ...detail, participants }
}

const TIMELINE_EVENTS = new Set(['CHAMPION_KILL', 'BUILDING_KILL', 'ELITE_MONSTER_KILL'])

/**
 * Riot's timeline as the app's own client games carry it (`lcu::win_probability`):
 * each player's gold, XP, CS and level a minute, and the kills, buildings and
 * epic monsters — what the Timeline, Graphs and Win Probability tabs read.
 */
export function winTimelineOf(timeline: RiotTimeline, participants: Pick<MatchDetailParticipant, 'participantId' | 'teamId' | 'teamPosition'>[], durationSeconds: number): WinProbabilityTimeline | null {
  const frames = timeline.info?.frames ?? []
  if (!frames.length) return null
  return {
    durationMs: durationSeconds * 1000,
    participants: participants.map(p => ({ participantId: p.participantId, teamId: p.teamId, position: p.teamPosition ?? '' })),
    frames: frames.map(frame => ({
      ms: frame.timestamp,
      players: Object.entries(frame.participantFrames ?? {}).map(([id, player]) => ({
        participantId: Number(id),
        cs: (player.minionsKilled ?? 0) + (player.jungleMinionsKilled ?? 0),
        level: player.level ?? 1,
        gold: player.totalGold,
        xp: player.xp,
      })),
    })),
    events: frames.flatMap(frame => frame.events).filter(event => TIMELINE_EVENTS.has(event.type)).map(event => ({
      type: event.type,
      ms: event.timestamp,
      killerId: event.killerId,
      victimId: event.victimId,
      assistIds: event.assistingParticipantIds,
      killerTeamId: event.killerTeamId,
      teamId: event.teamId,
      buildingType: event.buildingType,
      laneType: event.laneType,
      towerType: event.towerType,
      monsterType: event.monsterType,
      monsterSubType: event.monsterSubType,
    })),
  }
}

/**
 * Any game Blitz keeps (`BR1_123`), in the shape the shared match detail panel
 * reads: the scoreboard from the match (Riot's match-v5), the purchases and
 * skill points, the minute-by-minute standing and the kills and objectives
 * from its timeline (unless `withEvents` is off), the ten
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
      runes: [primary, secondary].flatMap(style => (style?.selections ?? []).map((selection, index) => ({ styleId: style!.style, selectionIndex: index, perkId: selection.perk, vars: [selection.var1 ?? 0, selection.var2 ?? 0, selection.var3 ?? 0] }))),
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
    winProbabilityTimeline: withEvents
      ? await readTimeline(matchId.split('_')[0] ?? '', matchId.split('_')[1] ?? '').then(timeline => winTimelineOf(timeline, participants, info.gameDuration)).catch(() => null)
      : null,
  })
}
