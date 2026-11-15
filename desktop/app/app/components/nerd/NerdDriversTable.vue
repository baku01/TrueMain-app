<script setup lang="ts">
import type { MetricAssociation } from '~/utils/nerd-stats/analysis'
import type { MetricTiming } from '~/utils/nerd-stats/features'

/**
 * The drivers as a statistician reads them, behind "show the maths": every
 * metric's Cohen's d between the wins and the losses with its 95% interval
 * as a forest plot around zero, the means in each, the point-biserial r with
 * its p-value and its Benjamini–Hochberg q (thirty-odd metrics tested at
 * once), and how many games carry it. A metric whose interval clears zero is
 * coloured by the side it leans to; one that does not stays grey.
 */
const props = defineProps<{ metrics: MetricAssociation[] }>()

const { t } = useT()
const f = useNerdFormat()
const tip = useChartTip()

const bound = computed(() => Math.min(5, Math.max(1, ...props.metrics.map(entry => Math.max(Math.abs(entry.effect!.low), Math.abs(entry.effect!.high))))))
const along = (d: number) => (Math.max(-bound.value, Math.min(bound.value, d)) / bound.value + 1) * 50
const ticks = computed(() => {
  const step = bound.value > 2.5 ? 1 : 0.5
  const out: number[] = []
  for (let tick = -Math.floor(bound.value / step) * step; tick <= bound.value + 1e-9; tick += step) out.push(Number(tick.toFixed(1)))
  return out
})

const toneOf = (entry: MetricAssociation) => (entry.effect!.low > 0 ? 'var(--nerd-win)' : entry.effect!.high < 0 ? 'var(--nerd-loss)' : 'var(--ui-text-dimmed)')

const TIMING_ICONS: Record<MetricTiming, string> = {
  pregame: 'i-tabler-flag',
  early: 'i-tabler-hourglass-low',
  performance: 'i-tabler-activity',
  outcome: 'i-tabler-trophy',
}

/** Cohen's own reading of |d|. */
const sizeOf = (d: number) => {
  const size = Math.abs(d)
  return size >= 0.8 ? 'large' : size >= 0.5 ? 'medium' : size >= 0.2 ? 'small' : 'negligible'
}

function showRow(event: MouseEvent | FocusEvent, entry: MetricAssociation) {
  const effect = entry.effect!
  tip.show(event, t(`nerd.metric.${entry.definition.key}`), [
    { label: t('nerd.drivers.dLabel', { size: t(`nerd.size.${sizeOf(effect.d)}`) }), value: f.signed(effect.d, 2), swatch: toneOf(entry) },
    { label: t('nerd.drivers.ciLabel'), value: `${f.number(effect.low, 2)} – ${f.number(effect.high, 2)}` },
    { label: t('nerd.wins'), value: f.metric(entry.definition, effect.meanA), swatch: 'var(--nerd-win)' },
    { label: t('nerd.losses'), value: f.metric(entry.definition, effect.meanB), swatch: 'var(--nerd-loss)' },
  ])
}
</script>

<template>
  <div :ref="el => (tip.box.value = el as HTMLElement)" class="relative overflow-x-auto">
    <table class="w-full min-w-[56rem] text-xs">
      <thead class="text-dimmed">
        <tr class="text-left">
          <th class="pb-2 font-medium">{{ t('nerd.col.metric') }}</th>
          <th class="pb-2 text-right font-medium"><span class="inline-flex items-center gap-1"><span class="size-1.5 rounded-full bg-(--nerd-win)" />{{ t('nerd.col.meanWin') }}</span></th>
          <th class="pb-2 text-right font-medium"><span class="inline-flex items-center gap-1"><span class="size-1.5 rounded-full bg-(--nerd-loss)" />{{ t('nerd.col.meanLoss') }}</span></th>
          <th class="w-[34%] px-4 pb-2 font-medium">
            <div class="relative h-3">
              <span v-for="tick in ticks" :key="tick" class="absolute -translate-x-1/2 tabular-nums" :style="{ left: `${along(tick)}%` }">{{ f.signed(tick, tick % 1 ? 1 : 0) }}</span>
            </div>
          </th>
          <th class="pb-2 text-right font-medium">d</th>
          <th class="pb-2 text-right font-medium">r<sub>pb</sub></th>
          <th class="pb-2 text-right font-medium">p</th>
          <th class="pb-2 text-right font-medium">q</th>
          <th class="pb-2 text-right font-medium">n</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(entry, index) in metrics" :key="entry.definition.key" class="border-t border-default/60 hover:bg-elevated/40">
          <td class="py-1.5 pr-3">
            <span class="flex items-center gap-2">
              <UIcon :name="TIMING_ICONS[entry.definition.timing]" class="size-3.5 shrink-0 text-dimmed" :title="t(`nerd.timing.${entry.definition.timing}`)" />
              <span class="font-medium text-highlighted">{{ t(`nerd.metric.${entry.definition.key}`) }}</span>
            </span>
          </td>
          <td class="py-1.5 text-right tabular-nums text-toned">{{ f.metric(entry.definition, entry.effect!.meanA) }}</td>
          <td class="py-1.5 text-right tabular-nums text-toned">{{ f.metric(entry.definition, entry.effect!.meanB) }}</td>
          <td class="px-4 py-1.5">
            <div
              class="relative h-5"
              tabindex="0"
              role="img"
              :aria-label="`${t(`nerd.metric.${entry.definition.key}`)}: d ${f.signed(entry.effect!.d, 2)}`"
              @pointerenter="showRow($event, entry)"
              @focus="showRow($event, entry)"
              @pointerleave="tip.hide"
              @blur="tip.hide"
            >
              <span v-for="tick in ticks" :key="tick" class="absolute inset-y-0 w-px" :class="tick === 0 ? 'bg-(--ui-border-accented)' : 'bg-(--ui-border)/50'" :style="{ left: `${along(tick)}%` }" />
              <span
                class="nerd-whisker absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
                :style="{ left: `${along(entry.effect!.low)}%`, width: `${along(entry.effect!.high) - along(entry.effect!.low)}%`, background: toneOf(entry), animationDelay: `${Math.min(index, 20) * 30}ms` }"
              />
              <span
                class="absolute top-1/2 size-2.5 -translate-1/2 rounded-full ring-2 ring-(--tm-pane)"
                :style="{ left: `${along(entry.effect!.d)}%`, background: toneOf(entry) }"
              />
            </div>
          </td>
          <td class="py-1.5 text-right font-semibold tabular-nums text-highlighted">{{ f.signed(entry.effect!.d, 2) }}</td>
          <td class="py-1.5 text-right tabular-nums">{{ entry.correlation ? f.signed(entry.correlation.r, 2) : '—' }}</td>
          <td class="py-1.5 text-right tabular-nums text-muted">{{ entry.correlation ? f.pValue(entry.correlation.p) : '—' }}</td>
          <td class="py-1.5 text-right tabular-nums" :class="entry.q < 0.05 ? 'font-semibold text-highlighted' : 'text-muted'">{{ f.pValue(entry.q) }}</td>
          <td class="py-1.5 text-right tabular-nums text-dimmed">{{ entry.games }}</td>
        </tr>
      </tbody>
    </table>
    <NerdTip :tip="tip.tip.value" />
    <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-dimmed">
      <span v-for="(icon, timing) in TIMING_ICONS" :key="timing" class="flex items-center gap-1"><UIcon :name="icon" class="size-3.5" />{{ t(`nerd.timing.${timing}`) }}</span>
    </div>
    <p class="mt-2 text-[11px] leading-relaxed text-dimmed">{{ t('nerd.drivers.hint') }}</p>
  </div>
</template>

<style scoped>
.nerd-whisker {
  transform-origin: center;
  animation: nerd-whisker 600ms var(--tm-ease) backwards;
}

@keyframes nerd-whisker {
  from { transform: scaleX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .nerd-whisker {
    animation: none;
  }
}
</style>
