<script setup lang="ts">
import type { OverlayPanel } from '~/types/overlay'
import { OVERLAY_PANELS, PANEL_KEY, onScoreboard, seeThrough } from '~/types/overlay'
import { PANEL_WIDTHS } from '~/utils/overlay-layout'
import { sampleGame } from '~/utils/overlay-sample'

// The panels are drawn over the game: always dark, whatever the window chose.
definePageMeta({ colorMode: 'dark' })

/**
 * One panel of the in-game overlay (#1795) — `next-item`, `win-probability`,
 * `stats`, `objectives` (#2078), `item-value`, `lane-gold` (#2186) or `tips` — loaded by that panel's own window (`src-tauri/src/overlay`),
 * never by the app's window, and drawn outside the app's shell (`app.vue`).
 *
 * The lane gold is the exception to the rest: its window is see-through and
 * the shell sizes it to the scoreboard's rows, so the page fills it with its
 * plates and reports only its width; it is never dragged, its place being the
 * scoreboard's.
 *
 * The panels are click-through and never take the keyboard, so nothing here
 * is interactive: they are read at a glance over the game. Each measures
 * itself and the shell sizes its window to it, so a panel covers no more of
 * the game than its content. In the settings' preview each can be dragged
 * into place, and says so; with no game to read, each then shows a sample
 * (`utils/overlay-sample.ts`) so it is placed at the size it will have over
 * the game — a panel flush against an edge stays flush against it.
 *
 * In a browser-only `npm run dev`, `?scenario=<id>` plays a dev scenario's
 * game here (`useDevScenarios`) and `?preview` shows the preview's state.
 */
const route = useRoute()
const panel = computed<OverlayPanel>(() => {
  const slug = String(route.params.panel)
  return (OVERLAY_PANELS as string[]).includes(slug) ? slug as OverlayPanel : 'next-item'
})

const PLACEHOLDERS: Record<OverlayPanel, string | null> = {
  'next-item': 'overlay.placeholder.nextItem',
  'win-probability': 'overlay.placeholder.winProbability',
  'item-value': 'overlay.placeholder.itemValue',
  'stats': 'overlay.placeholder.stats',
  'objectives': 'overlay.placeholder.objectives',
  'lane-gold': null,
  'tips': 'overlay.placeholder.tips',
}
const { t } = useT()
const placeholder = computed(() => {
  const key = PLACEHOLDERS[panel.value]
  return key ? t(key) : ''
})

const { game, sync } = useLiveGame()
const { view, fit } = useGameOverlay()
/** The chord that brings this panel up in game, marked in the preview (#1915). */
const chord = computed(() => view.value?.chords[panel.value]?.label ?? null)

const settings = computed(() => view.value?.settings ?? null)
const preview = computed(() => (view.value?.preview ?? false) || devPreview.value)
// Each panel at its own size.
const scale = computed(() => settings.value?.[PANEL_KEY[panel.value]].scale ?? 1)
const plates = computed(() => onScoreboard(panel.value))
// The next item and the pace are ours; the other panels read a spectated game too.
const OURS: OverlayPanel[] = ['next-item', 'stats']
const playing = computed(() => (!OURS.includes(panel.value) || game.value?.myTeam ? game.value : null))
// A real game always wins over the sample.
const isSample = computed(() => !playing.value)
const sample = sampleGame()
const { reference: paceReference } = usePaceBenchmark(computed(() => (panel.value === 'stats' ? playing.value : null)))

const devPreview = ref(false)
onMounted(async () => {
  if (!import.meta.dev || insideTauri()) return
  const query = new URL(window.location.href).searchParams
  devPreview.value = query.has('preview')
  const scenario = query.get('scenario')
  if (!scenario) return
  const { load, select } = useDevScenarios()
  await load()
  select(scenario)
})

// The window takes the content's size, scale included. The content is laid
// out at its natural size and scaled by a transform, so what is measured
// never depends on the scale it is drawn at.
const content = ref<HTMLElement | null>(null)
function measure() {
  const element = content.value
  if (element) void fit(panel.value, element.offsetWidth * scale.value, element.offsetHeight * scale.value)
}
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(measure)
  if (content.value) observer.observe(content.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch(scale, measure)

// A see-through window (the plates') shows the game through all
// but what the page draws: the page fill the theme pins on `html` goes, inline so it wins.
const clear = computed(() => seeThrough(panel.value))
const fill = computed(() => (clear.value ? 'overflow-hidden bg-transparent' : 'overflow-hidden bg-default'))
useHead({
  title: t('overlay.windowTitle'),
  htmlAttrs: { class: fill, style: computed(() => (clear.value ? 'background-color: transparent' : undefined)) },
  // The whole window tall: the content is scaled by a transform, which leaves its layout box — and so a body as tall as
  // it — at the unscaled height, and the body's overflow cut a panel grown past 100 % at its foot (the Tips panel's
  // second line, at 125 %).
  bodyAttrs: { class: computed(() => `${fill.value} min-h-screen`) },
})
</script>

<template>
  <div v-if="plates" class="origin-top-left" :style="{ transform: `scale(${scale})`, height: `${100 / scale}vh` }">
    <div ref="content" class="relative h-full" :style="{ width: `${PANEL_WIDTHS[panel]}px` }">
      <OverlayLaneGold v-if="playing || preview" :game="playing ?? sample" />
      <!-- In the preview, marked but not draggable: it goes where the scoreboard is. -->
      <span v-if="preview" class="pointer-events-none absolute inset-0 rounded-md ring-2 ring-inset ring-primary/70" />
      <span v-if="preview" class="pointer-events-none absolute inset-x-0 top-1 mx-auto flex w-fit items-center gap-0.5 rounded bg-primary px-1 py-0.5 text-[10px] font-semibold whitespace-nowrap text-inverted" :title="t('overlay.badge.onScoreboard')">
        <UIcon name="i-lucide-rows-3" class="size-2.5" />{{ chord ?? t('overlay.badge.sample') }}
      </span>
    </div>
  </div>
  <div v-else class="origin-top-left" :style="{ transform: `scale(${scale})` }">
    <div ref="content" class="relative isolate text-default" :class="!clear && 'px-3 py-2.5'" :style="{ width: `${PANEL_WIDTHS[panel]}px` }">
      <!-- The pane's material, under the content and exactly the window's size: the content box is the window. -->
      <span v-if="!clear" class="overlay-pane pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <!-- Keyed on what is shown, so a panel that starts reading a game arrives rather than snapping in. -->
      <div :key="playing ? 'live' : preview ? 'sample' : 'idle'" class="animate-overlay-in">
        <template v-if="playing">
          <OverlayNextItem v-if="panel === 'next-item'" :game="playing" />
          <OverlayWinProbability v-else-if="panel === 'win-probability'" :game="playing" :sync="sync" />
          <OverlayStats v-else-if="panel === 'stats'" :game="playing" :reference="paceReference" />
          <OverlayObjectives v-else-if="panel === 'objectives'" :game="playing" :sync="sync" />
          <OverlayTips v-else-if="panel === 'tips'" :game="playing" :sync="sync" />
          <OverlayItemValue v-else :game="playing" :lanes="!settings?.laneGold.enabled" />
        </template>
        <OverlayPanelSample v-else-if="preview" :panel="panel" />
        <div v-else-if="placeholder" class="flex items-center gap-2.5">
          <AppMark class="size-4 shrink-0 motion-safe:animate-tm-pulse" />
          <p class="text-[11px] leading-snug text-muted">{{ placeholder }}</p>
        </div>
      </div>

      <!--
        Over everything in the preview, so a drag starts wherever it is grabbed;
        drawn over the panel rather than under it, so the panel keeps the size
        it has over the game. The badge steps aside once the panel is grabbed.
      -->
      <div v-if="preview" data-tauri-drag-region class="group absolute inset-0 cursor-grab ring-2 ring-inset ring-primary/70">
        <span class="pointer-events-none absolute right-1 bottom-1 flex transition-opacity group-hover:opacity-0 items-center gap-1 rounded bg-primary px-1 py-0.5 text-[10px] font-semibold text-inverted">
          <UIcon name="i-lucide-move" class="size-2.5" />
          {{ isSample ? t('overlay.badge.sampleDrag') : t('overlay.badge.drag') }}<template v-if="chord"> · {{ chord }}</template>
        </span>
      </div>
    </div>
  </div>
</template>
