<script setup lang="ts">
import type { ClockSync } from '~/composables/useGameClock'
import type { GameState } from '~/types/game'
import type { TipKey } from '~/utils/tips/catalogue'
import { SAMPLE_PARAMS, TIP_RULES, makeTip } from '~/utils/tips/catalogue'

/**
 * The in-game tips, on the Tips panel: a pane like every other panel's, by
 * default under the objectives' strip, top centre, where League prints its
 * own announcements — so a tip reads like one, and the objectives' warnings,
 * most of the tips, sit by the timers they announce —, anywhere the player
 * drags it. Like every panel it reads the game itself: the feed
 * (`useTipFeed`) runs here, shows one tip at a time and says it; between two
 * the pane stays, saying there is none, so the panel is always there to see.
 *
 * In a browser-only `npm run dev`, `?tip=<key>,<key>` queues those tips with
 * made-up names and numbers, to look at them over a dev scenario.
 */
const props = defineProps<{ game: GameState, sync: ClockSync }>()

const { t } = useT()

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
    <OverlayTip v-if="shown" :key="shown.tip.id" :tip="shown.tip" />
    <div v-else key="idle" class="flex items-center gap-2">
      <span class="flex size-5 shrink-0 items-center justify-center">
        <UIcon name="i-lucide-lightbulb" class="size-4 text-dimmed" />
      </span>
      <p class="min-w-0 flex-1 text-xs leading-snug text-muted">{{ t('overlay.tips.idle') }}</p>
    </div>
  </Transition>
</template>
