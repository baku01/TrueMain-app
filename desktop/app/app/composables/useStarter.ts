import type { Ref } from 'vue'
import type { BuildItemSet, CompositionBuildResponse } from '~/types/build'
import type { GameState } from '~/types/game'
import { compositionStarter, starterBought, starterRequest } from '~/utils/next-item'
import { QUEST_LINE, isQuestReward, rewardApart, starterApart } from '~/utils/support-quest'

/**
 * The starter to buy in the running game, until one is bought: the basket the
 * draft's build opens with (`POST /champions/{id}/composition-build`, the
 * endpoint behind the draft's build panel) for the ten champions on their
 * lanes, or the lane's standard build's when the matchup was never recorded.
 *
 * Asked once per game — the starter does not move with the game — and never
 * once anything but potions and the trinket is held: the app opened mid-game
 * asks for nothing.
 */
export function useStarter(game: Ref<GameState>) {
  const { champions } = useChampionStatics()
  const { items: statics } = useStaticData()

  const idByAlias = computed(() => {
    const map = new Map<string, number>()
    for (const champion of champions.value.values()) map.set(champion.alias.toLowerCase(), champion.id)
    return map
  })

  const held = computed(() => game.value.players.find(player => player.isMe)?.items.map(item => item.itemId) ?? [])
  const bought = computed(() => starterBought(held.value, statics.value))
  const request = computed(() => starterRequest(game.value, alias => idByAlias.value.get(alias.toLowerCase()) ?? null))

  /** The starter to buy and, for a support, the quest's reward to pick (`utils/support-quest`). */
  const answer = ref<{ starter: BuildItemSet | null, reward: BuildItemSet | null } | null>(null)

  async function laneCore(championId: number, position: string) {
    const core = (await readChampionBuild(championId, position)).builds[0]?.core
    return core ? rewardApart(core) : null
  }

  let generation = 0
  async function ask(current: NonNullable<typeof request.value>) {
    const mine = ++generation
    try {
      const composition = await apiPost<CompositionBuildResponse>(`/champions/${current.championId}/composition-build`, current.body, {}, { background: true })
      const drafted = starterApart(compositionStarter(composition))
      // The lane's build where the draft's names no starter — or, for a support, no reward.
      const lane = !drafted.starter || (!drafted.reward && current.body.position === 'UTILITY') ? await laneCore(current.championId, current.body.position).catch(() => null) : null
      const basket = drafted.starter ?? lane?.starterItems ?? null
      if (mine === generation) answer.value = { starter: basket?.itemIds.length ? basket : null, reward: drafted.reward ?? lane?.questReward ?? null }
    }
    catch {
      // A starter that does not load is a starter not shown: the next item stands on its own.
      if (mine === generation) answer.value = null
    }
  }

  // Keyed on the draft, not the game state: items and gold move every reading.
  watch(
    () => (bought.value || !request.value ? '' : JSON.stringify(request.value)),
    (key, previous) => {
      if (key === previous) return
      // A starter read for another game, or another draft, must not stand in
      // while this one's is asked.
      answer.value = null
      ++generation
      if (key) ask(request.value!)
    },
    { immediate: true },
  )

  const starter = computed(() => (bought.value ? null : answer.value?.starter ?? null))
  // The reward to pick, until one is held: while the quest runs, or before a starting basket that begins it is bought.
  const questReward = computed(() => {
    const reward = answer.value?.reward
    if (!reward || held.value.some(isQuestReward)) return null
    const questing = held.value.some(id => QUEST_LINE.has(id)) || (starter.value?.itemIds.some(id => QUEST_LINE.has(id)) ?? false)
    return questing ? reward : null
  })

  return { starter, questReward }
}
