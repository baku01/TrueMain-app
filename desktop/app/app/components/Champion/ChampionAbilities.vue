<script setup lang="ts">
import type { AbilityData } from '~/utils/ability-data'
import { getActiveLocale } from '#common/utils/i18n'
import AbilityClip from '~/components/Champion/AbilityClip.vue'
import ChampionInsights from '~/components/Champion/ChampionInsights.vue'
import { perRank, readAbilities } from '~/utils/ability-data'

/**
 * The champion's abilities, the way Blitz shows them: the passive and Q, W,
 * E, R as cards, and for the one under the pointer (or picked) its clip, its
 * whole description with every figure, and its figures rank by rank
 * (`AbilityClip`). Read from the live game data (`utils/ability-data.ts`), so
 * a patch's changes show without an update; Data Dragon's icons beside them.
 * The champion's insights follow, under the abilities they speak of.
 */
const props = defineProps<{ championId: number }>()

const { t } = useT()
const { championStatic, loadChampion } = useStaticData()
const { patch } = useChampionStatics()
watch(() => `${props.championId}:${patch.value}`, () => loadChampion(props.championId), { immediate: true })

const COLORS: Record<string, string> = { P: 'text-muted', Q: 'text-orange-400', W: 'text-cyan-300', E: 'text-blue-400', R: 'text-yellow-300' }

const abilities = shallowRef<AbilityData[]>([])
const status = ref<'pending' | 'ready' | 'error'>('pending')
watch(() => props.championId, async (id) => {
  status.value = 'pending'
  abilities.value = []
  try {
    const read = await readAbilities(id, getActiveLocale().startsWith('pt') ? 'pt' : 'en')
    if (id !== props.championId) return
    abilities.value = read
    status.value = 'ready'
  }
  catch {
    if (id === props.championId) status.value = 'error'
  }
}, { immediate: true })

const active = ref<AbilityData['key']>('Q')
watch(() => props.championId, () => (active.value = 'Q'))
const current = computed(() => abilities.value.find(entry => entry.key === active.value) ?? abilities.value[0] ?? null)
const iconOf = (key: string) => championStatic(props.championId)?.championSpells[key]?.iconUrl ?? null
</script>

<template>
  <div class="min-h-0 space-y-6 overflow-y-auto">
    <div v-if="status === 'pending'" aria-busy="true" class="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div class="space-y-2"><USkeleton v-for="row in 5" :key="row" class="h-16 w-full rounded-xl" /></div>
      <USkeleton class="h-96 w-full rounded-2xl" />
    </div>
    <p v-else-if="status === 'error'" class="rounded-xl border border-dashed border-default px-4 py-10 text-center text-sm text-muted">{{ t('abilities.failed') }}</p>

    <div v-else class="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <ul class="space-y-2 self-start lg:sticky lg:top-0" role="listbox" :aria-label="t('abilities.tab')">
        <li v-for="entry in abilities" :key="entry.key">
          <button
            type="button"
            role="option"
            :aria-selected="active === entry.key"
            class="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition"
            :class="active === entry.key ? 'border-primary/50 bg-primary/10' : 'border-default bg-elevated/40 hover:border-accented hover:bg-elevated'"
            @mouseenter="active = entry.key"
            @focus="active = entry.key"
            @click="active = entry.key"
          >
            <span class="relative shrink-0">
              <img v-if="iconOf(entry.key)" :src="iconOf(entry.key)!" :alt="entry.name" width="44" height="44" class="size-11 rounded-lg ring-1 ring-default">
              <span v-else class="block size-11 rounded-lg bg-accented" />
              <span class="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded bg-default text-[10px] font-extrabold" :class="COLORS[entry.key]">{{ entry.key }}</span>
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-semibold text-highlighted">{{ entry.name }}</span>
              <span class="block truncate text-xs text-muted">
                <template v-if="entry.key === 'P'">{{ t('abilities.passive') }}</template>
                <template v-else-if="entry.cooldown.some(value => value > 0)">{{ t('abilities.cooldown') }}: {{ perRank(entry.cooldown) }}s</template>
              </span>
            </span>
          </button>
        </li>
      </ul>

      <article v-if="current" class="surface min-w-0 overflow-hidden rounded-2xl">
        <AbilityClip :champion-id="championId" :ability="current" :icon-url="iconOf(current.key)" :resource="current.resource ?? championStatic(championId)?.partype ?? null" />
      </article>
    </div>

    <!-- The champion's insights — strengths, weaknesses, tips — under its abilities. -->
    <section class="space-y-3">
      <h2 class="stat-label">{{ t('insights.tab') }}</h2>
      <ChampionInsights :champion-id="championId" />
    </section>
  </div>
</template>
