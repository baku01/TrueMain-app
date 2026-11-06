import type { DraftRecommendation, Lane, TeamRow } from '~/types/draft'
import type { DraftState } from '~/types/lcu'
import type { LaneSlot } from '~/composables/useLaneAssignment'
import { POSITIONS } from '#common/utils/positions'

/** The two teams of the draft board, one row per card. */
export function useDraftTeamRows(
  draft: Ref<DraftState>,
  recommendation: Ref<DraftRecommendation | null>,
  slots: Ref<LaneSlot[]>,
) {
  const { state: lcu } = useLcuState()

  /** Rows follow the lanes when the queue assigns them, so row n is a matchup. */
  const byLane = computed(() => draft.value.myPosition !== '')

  const allyRows = computed<TeamRow[]>(() => {
    const team = draft.value.myTeam
    const cells = byLane.value
      ? POSITIONS.map(lane => team.find(slot => slot.position === lane) ?? null)
      : Array.from({ length: 5 }, (_, index) => team[index] ?? null)
    return cells.map((slot, index) => ({
      championId: slot?.championId ?? null,
      lane: (slot?.position || (byLane.value ? POSITIONS[index] : null)) as Lane | null,
      locked: slot?.locked ?? false,
      me: slot?.isMe ?? false,
      // Our own Riot ID is the client's; an ally's, when the session names them.
      riotId: slot?.isMe ? lcu.value.riotId : (slot?.riotId ?? null),
    }))
  })

  /**
   * With a lane answer the enemies follow the lanes and can be corrected by
   * drag; without one — early draft, or a queue with no lanes — they are listed
   * in the order they picked, and only an empty board carries the lanes.
   */
  const enemyRows = computed<TeamRow[]>(() => {
    if (recommendation.value) {
      const enemies = draft.value.enemyChampions
      const rows = slots.value.map(slot => ({
        championId: slot.championId !== null && enemies.includes(slot.championId) ? slot.championId : null,
        lane: slot.lane,
        locked: true,
      }))
      // An enemy the answer does not place yet — picked after it was asked, or
      // its re-ask failed — still shows, on a lane left empty, until one does.
      const unplaced = enemies.filter(championId => !rows.some(row => row.championId === championId))
      for (const row of rows) {
        if (row.championId === null && unplaced.length) row.championId = unplaced.shift()!
      }
      return rows
    }
    const open = byLane.value && draft.value.enemyChampions.length === 0
    return Array.from({ length: 5 }, (_, index) => ({
      championId: draft.value.enemyChampions[index] ?? null,
      lane: (open ? POSITIONS[index] ?? null : null) as Lane | null,
      locked: true,
    }))
  })

  return { byLane, allyRows, enemyRows }
}
