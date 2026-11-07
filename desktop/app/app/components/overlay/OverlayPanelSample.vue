<script setup lang="ts">
import type { OverlayPanel } from '~/types/overlay'
import { buildPath } from '~/utils/build-path'
import { goldToComplete } from '~/utils/next-item'
import { SAMPLE_BUILD_ORDER, SAMPLE_NEXT_ITEM, SAMPLE_PACE_REFERENCE, sampleGame } from '~/utils/overlay-sample'
import { SAMPLE_TIP } from '~/utils/tips/catalogue'

/**
 * One overlay panel's content drawn over the sample game
 * (`utils/overlay-sample.ts`): the real component with made-up values, so a
 * panel is placed — in the layout editor or the on-screen preview — at the
 * size and look it will have over a game — the objectives with a tip under
 * them while the tips' text is on, so their room is part of the place.
 */
withDefaults(defineProps<{ panel: OverlayPanel, lanes?: boolean }>(), { lanes: true })

const game = sampleGame()
const sync = { gameTime: game.gameTime, at: Date.now() }
const { items } = useStaticData()
const next = computed(() => items.value[SAMPLE_NEXT_ITEM.itemId] ?? null)
const { itemId, held, gold, route } = SAMPLE_NEXT_ITEM
const path = computed(() => buildPath(itemId, route, held, gold, items.value))
const toComplete = computed(() => goldToComplete(itemId, held, items.value))
const missing = computed(() => Math.max(0, toComplete.value - gold))
const { settings: tips } = useTipSettings()
</script>

<template>
  <div v-if="panel === 'next-item'" class="space-y-2.5">
    <OverlayNextItemCard :item="next" :name="next?.name ?? 'Zhonya\'s Hourglass'" :missing="missing" :total="toComplete" />
    <OverlayNextItemPath :path="path" :order="SAMPLE_BUILD_ORDER" :statics="items" :gold="gold" />
  </div>
  <OverlayWinProbability v-else-if="panel === 'win-probability'" :game="game" :sync="sync" />
  <OverlayStats v-else-if="panel === 'stats'" :game="game" :reference="SAMPLE_PACE_REFERENCE" />
  <div v-else-if="panel === 'objectives'">
    <OverlayObjectives :game="game" :sync="sync" />
    <OverlayTip v-if="tips.text" :tip="SAMPLE_TIP" still class="mt-2" />
  </div>
  <OverlayLaneGold v-else-if="panel === 'lane-gold'" :game="game" />
  <OverlayItemValue v-else :game="game" :lanes="lanes" />
</template>
