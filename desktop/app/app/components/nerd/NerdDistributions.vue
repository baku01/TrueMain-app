<script setup lang="ts">
import type { MetricAssociation } from '~/utils/nerd-stats/analysis'
import type { MetricGroup } from '~/utils/nerd-stats/features'
import { isFew } from '~/utils/nerd-stats/insights'

/**
 * Every metric's distribution in wins and in losses, one card each
 * (`NerdMetricCard`), strongest effect first, filtered by family in one row
 * above them all, with how to read the cards' two charts said once.
 */
const props = defineProps<{
  metrics: MetricAssociation[]
  /** The player's overall win rate, ruled across every card's bins. */
  rate: number
}>()

const { t } = useT()
const f = useNerdFormat()
const GROUPS: (MetricGroup | 'all')[] = ['all', 'combat', 'economy', 'damage', 'vision', 'lane', 'objectives', 'context']
const group = ref<MetricGroup | 'all'>('all')
const games = computed(() => Math.max(0, ...props.metrics.map(entry => entry.games)))
const groups = computed(() => GROUPS
  .filter(value => value === 'all' || props.metrics.some(entry => entry.definition.group === value))
  .map(value => ({ value, label: t(`nerd.group.${value}`) })))
// What the player does first, what winning produces after it: both strongest effect first.
const shown = computed(() => props.metrics
  .filter(entry => group.value === 'all' || entry.definition.group === group.value)
  .sort((a, b) => Number(a.definition.timing === 'outcome') - Number(b.definition.timing === 'outcome')))
</script>

<template>
  <section class="space-y-3">
    <div class="flex flex-wrap items-center gap-3">
      <div class="min-w-0 flex-1">
        <h2 class="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-highlighted">
          {{ t('nerd.distributions.title') }}
          <span class="nerd-tech" :title="t('nerd.technicalName')">{{ t('nerd.distributions.technical') }}</span>
        </h2>
        <p class="text-xs text-muted">{{ t('nerd.distributions.subtitle') }}</p>
        <p v-if="isFew(games)" class="mt-1 flex items-center gap-1 text-[11px] font-medium text-warning">
          <UIcon name="i-lucide-triangle-alert" class="size-3.5 shrink-0" />{{ t('nerd.few') }}
        </p>
      </div>
      <span class="flex items-center gap-3 text-xs text-muted">
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-(--nerd-win)" />{{ t('nerd.wins') }}</span>
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-(--nerd-loss)" />{{ t('nerd.losses') }}</span>
        <span class="flex items-center gap-1.5"><span class="h-3 w-0.5 rounded-full bg-(--ui-text-highlighted)" />{{ t('nerd.distributions.mean') }}</span>
        <span class="flex items-center gap-1.5"><span class="nerd-dash w-3" />{{ t('nerd.ref.average', { rate: f.percent(rate) }) }}</span>
      </span>
      <AppSegmented v-model="group" :items="groups" />
    </div>
    <div class="grid gap-x-6 gap-y-1 lg:grid-cols-2">
      <NerdHowTo :text="t('nerd.distributions.howStrip')" />
      <NerdHowTo :text="t('nerd.distributions.howBins', { rate: f.percent(rate) })" />
    </div>
    <TransitionGroup tag="div" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" move-class="transition-transform duration-300">
      <NerdMetricCard v-for="entry in shown" :key="entry.definition.key" :entry="entry" :rate="rate" />
    </TransitionGroup>
  </section>
</template>
