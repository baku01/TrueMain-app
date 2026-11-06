<script setup lang="ts">
import type { ChampionPosition } from '#common/utils/positions'
import type { SynergySourceRead } from '~/utils/sources/synergies'
import { readSynergies } from '~/utils/sources/synergies'
import { DEFAULT_ALLY, searchPairs } from '~/utils/synergies'

/**
 * The champion's allies on one other lane, as Blitz's Synergies page: each
 * ally with the pair's tier, win rate, its delta over what the two
 * champions' own rates predict, and games. The ally lane opens on the one
 * the lane plays with most (the jungler for a solo lane, the other half of
 * the bot lane); a search narrows the allies by name. The badge names the
 * source the numbers came from (`readSynergies`).
 */
const props = defineProps<{ championId: number, position: string }>()
const { t } = useT()
const { nameOf } = useChampionStatics()

const ally = ref<ChampionPosition>((DEFAULT_ALLY[props.position] ?? 'JUNGLE') as ChampionPosition)
watch(() => props.position, position => (ally.value = (DEFAULT_ALLY[position] ?? 'JUNGLE') as ChampionPosition))
const query = ref('')

const read = ref<SynergySourceRead | null>(null)
const failed = ref(false)
const key = computed(() => `${props.championId}:${props.position}:${ally.value}`)
watch(key, async (asked) => {
  read.value = null
  failed.value = false
  try {
    const answer = await readSynergies(props.championId, props.position, ally.value)
    if (asked === key.value) read.value = answer
  }
  catch {
    if (asked === key.value) failed.value = true
  }
}, { immediate: true })

const rows = computed(() => searchPairs(read.value?.rows ?? [], query.value, nameOf))
</script>

<template>
  <div class="flex min-h-0 flex-col gap-3 overflow-y-auto">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div class="flex items-center gap-2">
        <span class="stat-label">{{ t('synergies.with') }}</span>
        <RolePicker :position="ally" hide-all :exclude="position as ChampionPosition" @update:position="value => value && (ally = value)" />
      </div>
      <UInput v-model="query" icon="i-lucide-search" size="sm" :placeholder="t('stats.search')" :aria-label="t('stats.search')" class="w-52" />
      <span class="flex-1" />
      <span v-if="read?.patch" class="text-xs tabular-nums text-dimmed">{{ t('counters.patch', { patch: read.patch }) }}</span>
      <StatsSourceBadge v-if="read" :source="read.source" />
    </div>
    <section class="surface rounded-2xl p-4">
      <h3 class="mb-2 text-sm font-semibold text-highlighted">{{ t('synergies.title', { champion: nameOf(championId) }) }}</h3>
      <p v-if="failed" class="py-6 text-center text-sm text-muted">{{ t('stats.failed') }}</p>
      <div v-else-if="!read" class="space-y-1.5">
        <USkeleton v-for="row in 8" :key="row" class="h-8 w-full" />
      </div>
      <StatsPairTable v-else :rows="rows" />
    </section>
  </div>
</template>
