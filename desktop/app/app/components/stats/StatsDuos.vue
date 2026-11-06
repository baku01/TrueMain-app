<script setup lang="ts">
import type { ChampionPosition } from '#common/utils/positions'
import type { SynergySourceRead } from '~/utils/sources/synergies'
import { readDuos } from '~/utils/sources/synergies'
import { searchPairs } from '~/utils/synergies'

/**
 * The best duos of two lanes across every champion, as Blitz's Duos page:
 * the bot lane's marksman and support first, any other pair of lanes on the
 * two pickers, a search by either champion's name. The badge names the
 * source the numbers came from (`readDuos`).
 */
const { t } = useT()
const { nameOf } = useChampionStatics()

const first = ref<ChampionPosition>('BOTTOM')
const second = ref<ChampionPosition>('UTILITY')
const query = ref('')

const read = ref<SynergySourceRead | null>(null)
const failed = ref(false)
const key = computed(() => `${first.value}:${second.value}`)
watch(key, async (asked) => {
  read.value = null
  failed.value = false
  try {
    const answer = await readDuos(first.value, second.value)
    if (asked === key.value) read.value = answer
  }
  catch {
    if (asked === key.value) failed.value = true
  }
}, { immediate: true })

const rows = computed(() => searchPairs(read.value?.rows ?? [], query.value, nameOf))
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <RolePicker :position="first" hide-all :exclude="second" @update:position="value => value && (first = value)" />
        <span class="stat-label">{{ t('stats.with') }}</span>
        <RolePicker :position="second" hide-all :exclude="first" @update:position="value => value && (second = value)" />
      </div>
      <UInput v-model="query" icon="i-lucide-search" size="sm" :placeholder="t('stats.search')" :aria-label="t('stats.search')" class="w-52" />
      <span class="flex-1" />
      <span v-if="read?.patch" class="text-xs tabular-nums text-dimmed">{{ t('counters.patch', { patch: read.patch }) }}</span>
      <StatsSourceBadge v-if="read" :source="read.source" />
    </div>
    <section class="surface rounded-2xl p-4">
      <p v-if="failed" class="py-6 text-center text-sm text-muted">{{ t('stats.failed') }}</p>
      <div v-else-if="!read" class="space-y-1.5">
        <USkeleton v-for="row in 10" :key="row" class="h-8 w-full" />
      </div>
      <StatsPairTable v-else :rows="rows" pair />
    </section>
  </div>
</template>
