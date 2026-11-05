<script setup lang="ts">
import type { EnemyReading } from '~/composables/useJevBuild'
import type { Needs } from '~/utils/jev-recommend'
import { NEEDS } from '~/utils/jev-recommend'

/**
 * What the recommendation is built against, as the page shows it: the enemy
 * team's needs — its measured damage split, and what Jev read of each kit
 * summed (crowd control, healing, burst, basic attacks, tankiness) — as bars,
 * then each enemy's own reading, the lane opponent first, with how sure Jev was.
 */
const props = defineProps<{ needs: { team: Needs, lane: Needs }, enemies: EnemyReading[] }>()
const { t } = useT()
const { portraitOf } = useChampionStatics()

const FACTS = ['cc', 'heal', 'burst', 'autos', 'tank'] as const
const percent = (value: number) => `${Math.round(value * 100)}%`
const level = (value: number) => (value >= 0.67 ? 'high' : value >= 0.34 ? 'some' : 'low')
const LEVEL_TONE = { high: 'bg-primary/15 text-primary', some: 'bg-accented/60 text-default', low: 'bg-accented/25 text-dimmed' } as const
const ordered = computed(() => [...props.enemies].sort((a, b) => Number(b.opponent) - Number(a.opponent)))
</script>

<template>
  <section class="surface grid gap-4 rounded-2xl p-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
    <div>
      <h3 class="stat-label mb-2">{{ t('jev.read.needs') }}</h3>
      <ul class="flex flex-col gap-1.5">
        <li v-for="need in NEEDS" :key="need" class="grid grid-cols-[7.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-xs" :title="t(`jev.need.${need}.hint`)">
          <span class="truncate text-muted">{{ t(`jev.need.${need}`) }}</span>
          <span class="h-1.5 overflow-hidden rounded-full bg-accented/70"><span class="block h-full rounded-full bg-primary" :style="{ width: percent(needs.team[need]) }" /></span>
          <span class="text-right tabular-nums text-default">{{ percent(needs.team[need]) }}</span>
        </li>
      </ul>
    </div>
    <div>
      <h3 class="stat-label mb-2">{{ t('jev.read.enemies') }}</h3>
      <ul class="flex flex-col gap-1.5">
        <li v-for="enemy in ordered" :key="enemy.id" class="flex flex-wrap items-center gap-2 rounded-lg bg-accented/15 px-2 py-1.5">
          <img v-if="portraitOf(enemy.id)" :src="portraitOf(enemy.id)!" :alt="enemy.name" width="28" height="28" class="img-skeleton size-7 rounded">
          <span class="w-24 truncate text-sm font-medium text-highlighted">{{ enemy.name }}</span>
          <UBadge v-if="enemy.opponent" :label="t('jev.read.opponent')" color="primary" variant="subtle" size="xs" />
          <span class="flex flex-wrap gap-1">
            <span v-for="fact in FACTS" :key="fact" class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="LEVEL_TONE[level(enemy.read[fact])]" :title="t(`jev.fact.${fact}.hint`)">
              {{ t(`jev.fact.${fact}`) }} · {{ t(`jev.level.${level(enemy.read[fact])}`) }}
            </span>
          </span>
          <span class="ml-auto text-[10px] tabular-nums text-dimmed" :title="t('jev.read.confidenceHint')">{{ t('jev.card.confidence', { value: percent(enemy.read.confidence) }) }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
