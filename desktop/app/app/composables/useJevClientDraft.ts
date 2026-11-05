import type { ChampionPosition } from '#common/utils/positions'
import { POSITION_OPTIONS } from '#common/utils/positions'
import { lolalyticsThenBlitz } from '~/utils/sources'
import { enemyLanesFromSource } from '~/utils/sources/draft'

/** The Jev matchup page's board as champion select fills it. */
export interface ClientBoard {
  championId: number | null
  /** Null in a queue that assigns no lane: the player's own choice stands. */
  position: ChampionPosition | null
  opponentId: number | null
  allies: Record<ChampionPosition, number | null>
  enemies: Record<ChampionPosition, number | null>
}

const LANES = POSITION_OPTIONS.map(option => option.value)
const isLane = (position: string): position is ChampionPosition => (LANES as string[]).includes(position)
const empty = (): Record<ChampionPosition, number | null> => ({ TOP: null, JUNGLE: null, MIDDLE: null, BOTTOM: null, UTILITY: null })

/**
 * Champion select read for the Jev matchup page: our champion (hovered or
 * locked) and lane, our allies on theirs, and the enemies on the lanes they
 * are likeliest to play — the client does not tell — read as the draft screen
 * reads them, from lolalytics then Blitz like the rest of the page. Null out
 * of champion select. Nothing is asked of Jev: its calls are paid, the player
 * asks.
 */
export function useJevClientDraft() {
  const { state } = useLcuState()
  const draft = computed(() => state.value.draft)
  const board = ref<ClientBoard | null>(null)
  let generation = 0

  const key = computed(() => {
    const current = draft.value
    if (!current) return null
    return JSON.stringify([current.myPosition, current.myChampion, current.myTeam.map(slot => [slot.championId, slot.position, slot.isMe]), current.enemyChampions])
  })

  watch(key, async () => {
    const mine = ++generation
    const current = draft.value
    if (!current) return void (board.value = null)
    const position = isLane(current.myPosition) ? current.myPosition : null
    const allies = empty()
    for (const slot of current.myTeam) {
      if (!slot.isMe && slot.championId && isLane(slot.position)) allies[slot.position] = slot.championId
    }
    const lanes = await enemyLanesFromSource(lolalyticsThenBlitz(), current.enemyChampions).catch(() => [])
    if (mine !== generation) return
    const enemies = empty()
    let opponentId: number | null = null
    for (const lane of lanes) {
      if (!isLane(lane.position)) continue
      if (lane.position === position) opponentId = lane.championId
      else enemies[lane.position] = lane.championId
    }
    board.value = { championId: current.myChampion, position, opponentId, allies, enemies }
  }, { immediate: true })

  return { inDraft: computed(() => draft.value !== null), board }
}
