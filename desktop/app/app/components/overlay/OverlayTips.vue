<script setup lang="ts">
import type { ClockSync } from '~/composables/useGameClock'
import type { GameState } from '~/types/game'
import type { TipKey } from '~/utils/tips/catalogue'
import type { ShownTip } from '~/utils/tips/queue'
import { TIP_SHOWN_EVENT } from '~/composables/useTipFeed'
import { SAMPLE_PARAMS, TIP_RULES, makeTip } from '~/utils/tips/catalogue'

/**
 * The in-game tips, in the tips panel's see-through window: by default under
 * the objectives' strip, top centre, where League prints its own
 * announcements — so a tip reads like one, and the objectives' warnings, most
 * of the tips, sit by the timers they announce —, anywhere the player drags
 * it. The feed runs in the app's window
 * (`useAppTipFeed`), which says the tips too; this window only draws the
 * one it sends, until its time is up — on this window's own clock, should
 * the app's be slow to send the next. Between two, nothing covers the
 * game.
 *
 * In a browser-only `npm run dev` there is no app's window to send them: the
 * page runs a feed of its own over the dev scenario's game, and
 * `?tip=<key>,<key>` queues those tips with made-up names and numbers.
 */
const props = defineProps<{ game: GameState, sync: ClockSync }>()

const shown = shallowRef<ShownTip | null>(null)
let hiding: ReturnType<typeof setTimeout> | undefined
function show(tip: ShownTip | null) {
  clearTimeout(hiding)
  shown.value = tip && tip.until > Date.now() ? tip : null
  if (shown.value) hiding = setTimeout(() => (shown.value = null), shown.value.until - Date.now())
}
onBeforeUnmount(() => clearTimeout(hiding))

if (import.meta.client && insideTauri()) {
  let stop: (() => void) | undefined
  onMounted(async () => {
    const { listen } = await import('@tauri-apps/api/event')
    stop = await listen<ShownTip | null>(TIP_SHOWN_EVENT, event => show(event.payload))
  })
  onBeforeUnmount(() => stop?.())
}
else {
  const feed = useTipFeed(() => props.game, () => props.sync)
  watch(feed.shown, show)
  onMounted(() => {
    if (!import.meta.dev) return
    const asked = new URL(window.location.href).searchParams.get('tip')
    for (const key of asked?.split(',') ?? []) {
      if (key in TIP_RULES) feed.push(makeTip(key as TipKey, SAMPLE_PARAMS))
    }
  })
}
</script>

<template>
  <Transition mode="out-in" enter-active-class="animate-overlay-in" leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
    <OverlayTip v-if="shown" :key="shown.tip.id" :tip="shown.tip" />
  </Transition>
</template>
