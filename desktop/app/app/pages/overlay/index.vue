<script setup lang="ts">
import { formatPercentage } from '#shared/utils/ddragon'
import type { OverlayPanel, OverlayPanelSettings, OverlaySettings, OverlayShow, PanelTrigger } from '~/types/overlay'
import type { Point } from '~/utils/overlay-layout'
import { OVERLAY_OPACITY, OVERLAY_PANELS, OVERLAY_SCALE, PANEL_KEY, SCOREBOARD_NUDGE, TIPS_PLACE } from '~/types/overlay'
import { nudgeLabel } from '~/utils/scoreboard-geometry'

/**
 * The in-game overlay (#1795), set up out of game (#1819), laid out as the
 * app's other pages are — its header, then a card per concern: where each
 * panel sits, on a small copy of the screen (`OverlayLayoutEditor`) or over
 * the real one; when each comes up in game (always, a chord held or
 * toggled, #1915) and the next item's moment; what goes for every panel —
 * size, opacity, the lane gold's nudge, the hide shortcut; then the tips and
 * their voice. Each change is saved as it is made; the shell's answer is
 * what then shows.
 *
 * Not `/overlay/<panel>`: those are the panels' own windows (`[panel].vue`),
 * drawn outside the app's shell.
 */
const { view, save, preview, readBinds } = useGameOverlay()
const current = computed(() => view.value?.settings ?? null)

const { t } = useT()
const SHOWS: { value: OverlayShow, label: string }[] = [{ value: 'always', label: t('overlay.settings.showAlways') }, { value: 'whileDead', label: t('overlay.settings.showWhileDead') }]

function apply(change: Partial<OverlaySettings>) {
  void save(change)
}
function applyPanel(panel: OverlayPanel, change: Partial<OverlayPanelSettings>) {
  if (!current.value) return
  const key = PANEL_KEY[panel]
  apply({ [key]: { ...current.value[key], ...change } })
}
const place = (panel: OverlayPanel, custom: Point) => applyPanel(panel, { enabled: true, custom })
const show = (panel: OverlayPanel) => applyPanel(panel, { enabled: true })
const hide = (panel: OverlayPanel) => applyPanel(panel, { enabled: false })
const setTrigger = (panel: OverlayPanel, trigger: PanelTrigger) => applyPanel(panel, { trigger })

const shownPanels = computed(() => OVERLAY_PANELS.filter(panel => current.value?.[PANEL_KEY[panel]].enabled))
// The chords' warnings read the player's own League keybindings when the client is there.
onMounted(() => void readBinds())

/** Each panel's own place: its anchor's spot, or the tips' (`TIPS_PLACE`). */
const placeOf = (panel: OverlayPanel): Point | null => (panel === 'tips' ? { ...TIPS_PLACE } : null)
const samePlace = (a: Point | null, b: Point | null) => a?.x === b?.x && a?.y === b?.y
/** Every panel back on its own place. */
const moved = computed(() => OVERLAY_PANELS.some(panel => current.value && !samePlace(current.value[PANEL_KEY[panel]].custom, placeOf(panel))))
function resetPositions() {
  if (!current.value) return
  const settings = current.value
  apply(Object.fromEntries(OVERLAY_PANELS.map(panel => [PANEL_KEY[panel], { ...settings[PANEL_KEY[panel]], custom: placeOf(panel) }])))
}

// Sliders save once they settle, not on every step of a drag.
const scale = ref(1)
const opacity = ref(0.95)
const nudge = ref(0)
watch(() => current.value?.scale, value => (scale.value = value ?? 1), { immediate: true })
watch(() => current.value?.opacity, value => (opacity.value = value ?? 0.95), { immediate: true })
watch(() => current.value?.scoreboardNudge, value => (nudge.value = value ?? 0), { immediate: true })
let timer: ReturnType<typeof setTimeout> | undefined
function settle(change: Partial<OverlaySettings>) {
  clearTimeout(timer)
  timer = setTimeout(() => apply(change), 250)
}
onBeforeUnmount(() => clearTimeout(timer))

// The on-screen preview lasts as long as this page.
onBeforeUnmount(() => void preview(false))
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto">
    <div class="space-y-5 p-6">
      <PageHeader :title="t('overlay.title')" :description="t('overlay.description')">
        <template #actions>
          <USwitch
            v-if="current"
            :model-value="current.enabled"
            :label="t('overlay.settings.showInGame')"
            :disabled="view?.supported === false"
            @update:model-value="apply({ enabled: $event })"
          />
        </template>
      </PageHeader>

      <UAlert
        v-if="view && !view.supported"
        color="neutral"
        variant="subtle"
        icon="i-lucide-monitor-x"
        :title="t('overlay.settings.unsupported.title')"
        :description="t('overlay.settings.unsupported.description')"
      />
      <UAlert v-else-if="view?.notice" color="neutral" variant="subtle" icon="i-lucide-info" :description="view.notice" />

      <USkeleton v-if="!current" class="aspect-video w-full rounded-xl" />
      <template v-else>
        <section class="surface space-y-4 rounded-xl p-5" data-overlay-layout>
          <header class="flex flex-wrap items-start gap-3">
            <UIcon name="i-tabler-layout-dashboard" class="mt-0.5 size-5 shrink-0 text-primary" />
            <div class="min-w-0 flex-1 space-y-1">
              <h2 class="text-sm font-semibold text-highlighted">{{ t('overlay.layout.title') }}</h2>
              <p class="text-xs text-muted">{{ view?.preview ? t('overlay.settings.onScreenPreviewing') : t('overlay.layout.description') }}</p>
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
              <UButton v-if="moved" :label="t('overlay.settings.resetPositions')" icon="i-lucide-rotate-ccw" size="sm" color="neutral" variant="ghost" @click="resetPositions" />
              <UButton
                :label="view?.preview ? t('overlay.settings.done') : t('overlay.settings.placeOnScreen')"
                :icon="view?.preview ? 'i-lucide-check' : 'i-lucide-move'"
                size="sm"
                :color="view?.preview ? 'primary' : 'neutral'"
                :variant="view?.preview ? 'solid' : 'outline'"
                :disabled="!view?.supported"
                @click="preview(!view?.preview)"
              />
            </div>
          </header>
          <OverlayLayoutEditor
            :settings="current"
            :chords="view?.chords"
            :hud="view?.hud"
            :class="!current.enabled && 'opacity-60'"
            @place="place"
            @show="show"
            @hide="hide"
          />
        </section>

        <div class="grid items-start gap-5 xl:grid-cols-2">
          <section class="surface space-y-4 rounded-xl p-5" data-overlay-when>
            <header class="flex items-start gap-3">
              <UIcon name="i-tabler-eye" class="mt-0.5 size-5 shrink-0 text-primary" />
              <div class="min-w-0 flex-1 space-y-1">
                <h2 class="text-sm font-semibold text-highlighted">{{ t('overlay.when.title') }}</h2>
                <p class="text-xs text-muted">{{ t('overlay.when.description') }}</p>
              </div>
            </header>

            <div v-if="current.nextItem.enabled" class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="stat-label">{{ t('overlay.settings.buildPathShows') }}</h3>
              <AppSegmented :model-value="current.show" :items="SHOWS" @update:model-value="apply({ show: $event })" />
            </div>

            <div v-if="shownPanels.length" class="grid gap-3 sm:grid-cols-2">
              <OverlayTriggerPicker
                v-for="panel in shownPanels"
                :key="panel"
                class="surface rounded-lg p-3"
                :panel="panel"
                :trigger="current[PANEL_KEY[panel]].trigger"
                :chord="view?.chords[panel] ?? null"
                @change="setTrigger(panel, $event)"
              />
            </div>
            <p v-else class="text-xs text-dimmed">{{ t('overlay.when.empty') }}</p>
          </section>

          <section class="surface space-y-5 rounded-xl p-5" data-overlay-look>
            <header class="flex items-start gap-3">
              <UIcon name="i-tabler-adjustments-horizontal" class="mt-0.5 size-5 shrink-0 text-primary" />
              <div class="min-w-0 flex-1 space-y-1">
                <h2 class="text-sm font-semibold text-highlighted">{{ t('overlay.look.title') }}</h2>
                <p class="text-xs text-muted">{{ t('overlay.look.description') }}</p>
              </div>
            </header>

            <div class="grid gap-5 sm:grid-cols-2">
              <div class="space-y-2">
                <div class="flex items-baseline justify-between">
                  <h3 class="stat-label">{{ t('overlay.settings.size') }}</h3>
                  <span class="stat-value text-sm">{{ formatPercentage(scale, 0) }}</span>
                </div>
                <USlider
                  :model-value="scale"
                  :min="OVERLAY_SCALE.min"
                  :max="OVERLAY_SCALE.max"
                  :step="0.05"
                  size="sm"
                  :aria-label="t('overlay.settings.size')"
                  @update:model-value="(value) => { scale = value ?? scale; settle({ scale }) }"
                />
              </div>
              <div class="space-y-2">
                <div class="flex items-baseline justify-between">
                  <h3 class="stat-label">{{ t('overlay.settings.opacity') }}</h3>
                  <span class="stat-value text-sm">{{ formatPercentage(opacity, 0) }}</span>
                </div>
                <USlider
                  :model-value="opacity"
                  :min="OVERLAY_OPACITY.min"
                  :max="OVERLAY_OPACITY.max"
                  :step="0.05"
                  size="sm"
                  :aria-label="t('overlay.settings.opacity')"
                  @update:model-value="(value) => { opacity = value ?? opacity; settle({ opacity }) }"
                />
              </div>
              <div v-if="current.laneGold.enabled" class="space-y-2 sm:col-span-2">
                <div class="flex items-baseline justify-between">
                  <h3 class="stat-label">{{ t('overlay.settings.laneGoldNudge') }}</h3>
                  <span class="stat-value text-sm">{{ nudgeLabel(nudge) }}</span>
                </div>
                <USlider
                  :model-value="nudge"
                  :min="-SCOREBOARD_NUDGE"
                  :max="SCOREBOARD_NUDGE"
                  :step="2"
                  size="sm"
                  :aria-label="t('overlay.settings.laneGoldNudge')"
                  @update:model-value="(value) => { nudge = value ?? nudge; settle({ scoreboardNudge: nudge }) }"
                />
              </div>
            </div>

            <div class="flex items-center gap-3 rounded-lg bg-accented/50 px-3 py-2">
              <h3 class="stat-label shrink-0">{{ t('overlay.settings.shortcut') }}</h3>
              <UKbd size="md">{{ view?.shortcut }}</UKbd>
              <span class="text-xs text-muted">{{ t('overlay.settings.shortcutHint') }}</span>
            </div>
          </section>

          <OverlayTipsSettings :overlay="current" />
          <OverlayVoicePacks />
        </div>
      </template>
    </div>
  </div>
</template>
