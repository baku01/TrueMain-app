<script setup lang="ts">
import type { MetricAssociation } from '~/utils/nerd-stats/analysis'
import type { MetricSplit } from '~/utils/nerd-stats/insights'
import type { MetricTiming } from '~/utils/nerd-stats/features'
import { isFew, metricSplit } from '~/utils/nerd-stats/insights'

/**
 * What comes with winning, said plainly: each metric as the player's win rate
 * in their games with more of it against those with less — ahead against
 * behind for a lead, yes against no, the top bin against the bottom one —
 * drawn as two dots on a 0–100% track with a coin flip and their own average
 * ruled across it, the gap in points and how far it can be trusted (its
 * q-value, in a word). Ranked by the size of the effect (Cohen's d), the
 * strongest first; the result's own consequences (towers, barons, level,
 * length) hidden by default, since a won game having more towers says nothing
 * about why. The table of d, r, p and q is behind "show the maths".
 */
const props = defineProps<{
  metrics: MetricAssociation[]
  games: number
  /** The player's overall win rate. */
  rate: number
}>()

const { t } = useT()
const f = useNerdFormat()
const say = useNerdSay()
const tip = useChartTip()

const showOutcome = ref(false)
const shown = computed(() => props.metrics.filter(entry => entry.effect && (showOutcome.value || entry.definition.timing !== 'outcome')))
const hiddenCount = computed(() => props.metrics.filter(entry => entry.definition.timing === 'outcome').length)
const rows = computed(() => shown.value.flatMap((entry) => {
  const split = metricSplit(entry)
  return split ? [{ entry, split }] : []
}))

const SHOWN = 12
const all = ref(false)
const visible = computed(() => (all.value ? rows.value : rows.value.slice(0, SHOWN)))

const lead = computed(() => rows.value.find(row => row.entry.definition.timing !== 'outcome' && (row.split.confidence === 'strong' || row.split.confidence === 'moderate')) ?? null)

const TIMING_ICONS: Record<MetricTiming, string> = {
  pregame: 'i-tabler-flag',
  early: 'i-tabler-hourglass-low',
  performance: 'i-tabler-activity',
  outcome: 'i-tabler-trophy',
}

const sideLabel = (split: MetricSplit, high: boolean) => t(`nerd.drivers.side.${split.kind}.${high ? 'high' : 'low'}`)

function showRow(event: MouseEvent | FocusEvent, entry: MetricAssociation, split: MetricSplit) {
  tip.show(event, t(`nerd.metric.${entry.definition.key}`), [
    { label: sideLabel(split, true), value: `${f.percent(split.high.rate)} · ${t('nerd.distributions.games', { count: split.high.games })}`, swatch: 'var(--ui-text-highlighted)' },
    { label: sideLabel(split, false), value: `${f.percent(split.low.rate)} · ${t('nerd.distributions.games', { count: split.low.games })}`, swatch: 'var(--ui-text-dimmed)' },
  ])
}
</script>

<template>
  <section class="surface rounded-lg">
    <NerdCardHeader icon="i-tabler-chart-arrows-vertical" :title="t('nerd.drivers.title')" :technical="t('nerd.drivers.technical')" :subtitle="t('nerd.drivers.subtitle', { count: games })">
      <USwitch v-model="showOutcome" size="sm" :label="t('nerd.drivers.showOutcome', { count: hiddenCount })" />
    </NerdCardHeader>

    <div class="space-y-3 p-4">
      <NerdLead
        v-if="lead"
        :text="say.split(lead.entry, lead.split)!"
        :confidence="lead.split.confidence"
        :detail="say.metricDetail(lead.entry)"
        :few="isFew(games)"
        :tone="lead.split.difference >= 0 ? 'win' : 'loss'"
      />
      <NerdLead v-else :text="t('nerd.drivers.noLead')" :few="isFew(games)" />

      <div :ref="el => (tip.box.value = el as HTMLElement)" class="relative">
        <div class="nerd-driver-grid pb-1 text-[10px] tabular-nums text-dimmed">
          <span />
          <div class="relative h-3">
            <span v-for="tick in [0, 0.25, 0.5, 0.75, 1]" :key="tick" class="absolute -translate-x-1/2" :style="{ left: `${tick * 100}%` }">{{ f.percent(tick) }}</span>
          </div>
          <span class="text-right">{{ t('nerd.drivers.gap') }}</span>
          <span class="text-right">{{ t('nerd.confidence.label') }}</span>
        </div>
        <TransitionGroup tag="ul" move-class="transition-transform duration-300" class="divide-y divide-default/60">
          <li v-for="({ entry, split }, index) in visible" :key="entry.definition.key" class="nerd-driver-grid py-2">
            <div class="min-w-0">
              <p class="flex items-center gap-1.5 text-[13px] font-medium text-highlighted">
                <UIcon :name="TIMING_ICONS[entry.definition.timing]" class="size-3.5 shrink-0 text-dimmed" :title="t(`nerd.timing.${entry.definition.timing}`)" />
                <span class="truncate">{{ t(`nerd.metric.${entry.definition.key}`) }}</span>
              </p>
              <p class="mt-0.5 text-[11.5px] leading-snug text-muted"><NerdRich :text="say.split(entry, split)!" /></p>
            </div>
            <div
              class="relative h-6 self-center"
              tabindex="0"
              role="img"
              :aria-label="`${t(`nerd.metric.${entry.definition.key}`)}: ${sideLabel(split, true)} ${f.percent(split.high.rate)}, ${sideLabel(split, false)} ${f.percent(split.low.rate)}`"
              @pointerenter="showRow($event, entry, split)"
              @focus="showRow($event, entry, split)"
              @pointerleave="tip.hide"
              @blur="tip.hide"
            >
              <span class="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-accented/50" />
              <span class="absolute inset-y-0 left-1/2 w-px bg-(--ui-border-accented)" />
              <span class="nerd-dash-v absolute inset-y-0" :style="{ left: `${rate * 100}%` }" />
              <span
                class="nerd-span absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
                :style="{
                  left: `${Math.min(split.high.rate, split.low.rate) * 100}%`,
                  width: `${Math.abs(split.difference) * 100}%`,
                  background: split.difference >= 0 ? 'var(--nerd-win)' : 'var(--nerd-loss)',
                  animationDelay: `${Math.min(index, 12) * 40}ms`,
                }"
              />
              <span class="absolute top-1/2 size-2.5 -translate-1/2 rounded-full bg-(--tm-pane) ring-2 ring-(--ui-text-dimmed) transition-[left] duration-300" :style="{ left: `${split.low.rate * 100}%` }" />
              <span class="absolute top-1/2 size-3 -translate-1/2 rounded-full bg-(--ui-text-highlighted) ring-2 ring-(--tm-pane) transition-[left] duration-300" :style="{ left: `${split.high.rate * 100}%` }" />
            </div>
            <span class="self-center text-right text-xs font-semibold tabular-nums" :class="split.difference >= 0 ? 'text-(--nerd-win)' : 'text-(--nerd-loss)'">{{ t('nerd.points', { diff: f.points(split.difference) }) }}</span>
            <span class="self-center text-right"><NerdConfidence :level="split.confidence" :detail="say.metricDetail(entry)" /></span>
          </li>
        </TransitionGroup>
        <NerdTip :tip="tip.tip.value" />
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-dimmed">
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-(--ui-text-highlighted)" />{{ t('nerd.drivers.legendHigh') }}</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full ring-2 ring-inset ring-(--ui-text-dimmed)" />{{ t('nerd.drivers.legendLow') }}</span>
        <span class="flex items-center gap-1.5"><span class="h-3 w-px bg-(--ui-border-accented)" />{{ t('nerd.ref.coin') }}</span>
        <span class="flex items-center gap-1.5"><span class="nerd-dash-v relative h-3" />{{ t('nerd.ref.average', { rate: f.percent(rate) }) }}</span>
        <UButton v-if="rows.length > SHOWN" class="ml-auto" size="xs" color="neutral" variant="ghost" :label="all ? t('nerd.groups.less') : t('nerd.groups.more', { count: rows.length - SHOWN })" @click="all = !all" />
      </div>
      <NerdHowTo :text="t('nerd.drivers.how')" />

      <NerdDetails>
        <NerdDriversTable :metrics="shown" />
      </NerdDetails>
    </div>
  </section>
</template>

<style scoped>
.nerd-driver-grid {
  display: grid;
  grid-template-columns: minmax(12rem, 1.1fr) minmax(10rem, 1fr) 4.5rem 6.5rem;
  gap: 0.25rem 1rem;
}

.nerd-span {
  transform-origin: left;
  animation: nerd-span 600ms var(--tm-ease) backwards;
}

@keyframes nerd-span {
  from { transform: scaleX(0); }
}

@media (max-width: 52rem) {
  .nerd-driver-grid {
    grid-template-columns: minmax(0, 1fr) 4.5rem 6.5rem;
  }

  .nerd-driver-grid > :nth-child(2) {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nerd-span {
    animation: none;
  }
}
</style>
