<script setup lang="ts">
import type { ClockSync } from '~/composables/useGameClock'
import type { GameState } from '~/types/game'
import type { TipKey } from '~/utils/tips/catalogue'
import { SAMPLE_PARAMS, TIP_RULES, makeTip } from '~/utils/tips/catalogue'

/**
 * The in-game tips, under the objectives strip in the objectives panel's
 * window: top centre, where League prints its own announcements, so a tip
 * reads like one — and the objectives' warnings, most of the tips, sit by
 * the timers they announce. The feed (`useTipFeed`) runs here, one tip on
 * screen at a time; between two, nothing, and the panel is the strip alone.
 *
 * In a browser-only `npm run dev`, `?tip=<key>,<key>` queues those tips with
 * made-up names and numbers, to look at them over a dev scenario.
 */
const props = defineProps<{ game: GameState, sync: ClockSync }>()

const { shown, push } = useTipFeed(() => props.game, () => props.sync)

onMounted(() => {
  if (!import.meta.dev || insideTauri()) return
  const asked = new URL(window.location.href).searchParams.get('tip')
  for (const key of asked?.split(',') ?? []) {
    if (key in TIP_RULES) push(makeTip(key as TipKey, SAMPLE_PARAMS))
  }
})
</script>

<template>
  <Transition mode="out-in" enter-active-class="animate-overlay-in" leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
    <OverlayTip v-if="shown" :key="shown.tip.id" :tip="shown.tip" class="mt-2" />
  </Transition>
</template>
