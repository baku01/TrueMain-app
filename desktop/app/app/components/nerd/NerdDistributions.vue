<script setup lang="ts">
import type { MetricAssociation } from '~/utils/nerd-stats/analysis'
import type { MetricGroup } from '~/utils/nerd-stats/features'

/**
 * Every metric's distribution in wins and in losses, one card each
 * (`NerdMetricCard`), strongest effect first, filtered by family in one row
 * above them all.
 */
const props = defineProps<{ metrics: MetricAssociation[] }>()

const { t } = useT()
const GROUPS: (MetricGroup | 'all')[] = ['all', 'combat', 'economy', 'damage', 'vision', 'lane', 'objectives', 'context']
const group = ref<MetricGroup | 'all'>('all')
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
        <h2 class="text-base font-semibold text-highlighted">{{ t('nerd.distributions.title') }}</h2>
        <p class="text-xs text-muted">{{ t('nerd.distributions.subtitle') }}</p>
      </div>
      <span class="flex items-center gap-3 text-xs text-muted">
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-(--nerd-win)" />{{ t('nerd.wins') }}</span>
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-(--nerd-loss)" />{{ t('nerd.losses') }}</span>
        <span class="flex items-center gap-1.5"><span class="h-3 w-0.5 rounded-full bg-(--ui-text-highlighted)" />{{ t('nerd.distributions.mean') }}</span>
      </span>
      <AppSegmented v-model="group" :items="groups" />
    </div>
    <TransitionGroup tag="div" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" move-class="transition-transform duration-300">
      <NerdMetricCard v-for="entry in shown" :key="entry.definition.key" :entry="entry" />
    </TransitionGroup>
  </section>
</template>
