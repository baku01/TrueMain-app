import type { PlayerGame } from '~/types/record'
import type { MatchAnswer, Participant, RiotTimeline } from '~/utils/blitz/player'

/**
 * The made-up history (`synthetic-history`) as Blitz would answer it, for
 * `npm run dev`: each game written back into Riot's match-v5 shape and its
 * timeline, so the nerd page reads them through the very converter it reads
 * Blitz with (`gameOf`, `withMarks`) rather than being handed `PlayerGame`s.
 *
 * Dev-only, like every fixture: nothing here is a measurement. Only what the
 * converter reads is written; the other nine players' items, spells and runes
 * are left empty, as the analysis never reads them.
 */

const GAME_VERSION = '16.22.1'

/** One game as Blitz's `match` answers it; the player's line under `puuid`, the others under made-up ones. */
export function matchAnswerOf(game: PlayerGame, platform: string, puuid: string): MatchAnswer {
  const participants = game.participants.map<Participant>((p) => {
    const mine = p.participantId === game.participantId
    const items = mine ? [...game.items, 0, 0, 0, 0, 0, 0].slice(0, 6) : [0, 0, 0, 0, 0, 0]
    return {
      puuid: mine ? puuid : `synthetic-${game.gameId}-${p.participantId}`,
      riotIdGameName: p.gameName ?? undefined,
      riotIdTagline: p.tagLine ?? undefined,
      championId: p.championId,
      teamId: p.teamId,
      teamPosition: p.position ?? '',
      participantId: p.participantId,
      win: p.win,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      summoner1Id: mine ? game.spells[0] : 4,
      summoner2Id: mine ? game.spells[1] : 14,
      item0: items[0]!, item1: items[1]!, item2: items[2]!, item3: items[3]!, item4: items[4]!, item5: items[5]!,
      item6: mine ? game.trinket : 3340,
      champLevel: mine ? game.championLevel : 15,
      totalDamageDealtToChampions: p.damageToChampions,
      visionScore: p.visionScore,
      goldEarned: p.goldEarned,
      totalMinionsKilled: p.cs,
      neutralMinionsKilled: 0,
      roleBoundItem: mine ? game.roleBoundItem : 0,
      largestMultiKill: mine ? game.largestMultiKill : 1,
      damageSelfMitigated: p.damageSelfMitigated,
      damageDealtToTurrets: p.damageToTurrets,
      gameEndedInEarlySurrender: game.remake,
      firstBloodKill: mine ? game.firstBlood ?? false : false,
      doubleKills: mine ? game.multiKills?.double ?? 0 : 0,
      tripleKills: mine ? game.multiKills?.triple ?? 0 : 0,
      quadraKills: mine ? game.multiKills?.quadra ?? 0 : 0,
      pentaKills: mine ? game.multiKills?.penta ?? 0 : 0,
      perks: mine ? { styles: [{ style: game.primaryStyle, selections: [{ perk: game.keystone }] }, { style: game.subStyle, selections: [] }] } : undefined,
    }
  })
  return {
    metadata: { matchId: `${platform}_${game.gameId}` },
    info: {
      gameCreation: game.playedAt,
      gameDuration: game.durationSeconds,
      gameVersion: GAME_VERSION,
      queueId: game.queueId,
      mapId: game.mapId,
      platformId: platform,
      participants,
      teams: (game.teams ?? []).map(team => ({
        teamId: team.teamId,
        bans: team.bans.map((championId, index) => ({ championId, pickTurn: index + 1 })),
        objectives: {
          tower: { kills: team.towers },
          inhibitor: { kills: team.inhibitors },
          dragon: { kills: team.dragons },
          baron: { kills: team.barons },
          riftHerald: { kills: team.heralds },
          ...(team.grubs === null ? {} : { horde: { kills: team.grubs } }),
        },
      })),
    },
  }
}

/** The game's timeline as Blitz's `timeline` answers it: a frame at each mark the game's players carry, a few seconds off the minute. */
export function timelineOf(game: PlayerGame): RiotTimeline {
  const minutes = [...new Set(game.participants.flatMap(p => p.marks.map(mark => mark.minute)))].sort((a, b) => a - b)
  return {
    info: {
      frameInterval: 60_000,
      frames: minutes.map(minute => ({
        timestamp: minute * 60_000 + 412,
        events: [],
        participantFrames: Object.fromEntries(game.participants.flatMap((p) => {
          const mark = p.marks.find(entry => entry.minute === minute)
          return mark ? [[String(p.participantId), { totalGold: mark.gold, xp: mark.xp, minionsKilled: mark.cs, jungleMinionsKilled: 0 }]] : []
        })),
      })),
    },
  }
}
