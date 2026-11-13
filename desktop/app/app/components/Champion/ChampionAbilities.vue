<script setup lang="ts">
import type { AbilityData } from '~/utils/ability-data'
import { getActiveLocale } from '#common/utils/i18n'
import AbilityClip from '~/components/Champion/AbilityClip.vue'
import ChampionInsights from '~/components/Champion/ChampionInsights.vue'
import { perRank, quickAbilities, readAbilities } from '~/utils/ability-data'
import { warmClips } from '~/utils/ability-clips'

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

const COLORS: Record<string, string> = { P: 'text-muted', Q: 'text-toned', W: 'text-toned', E: 'text-toned', R: 'text-primary' }

const abilities = shallowRef<AbilityData[]>([])
const status = ref<'pending' | 'ready' | 'error'>('pending')
watch(() => props.championId, async (id) => {
  status.value = 'pending'
  abilities.value = []
  // Every clip of the tab starts downloading now, the one on screen first: they do not wait on the game data.
  warmClips(id, ['Q', 'W', 'E', 'R', 'P'])
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
/** The game data's abilities once read; Data Dragon's until then, so the clips and texts show at once (`quickAbilities`). */
const shown = computed(() => (abilities.value.length ? abilities.value : quickAbilities(championStatic(props.championId))))
const view = computed(() => (shown.value.length ? 'ready' : status.value))
const current = computed(() => shown.value.find(entry => entry.key === active.value) ?? shown.value[0] ?? null)
const iconOf = (key: string) => championStatic(props.championId)?.championSpells[key]?.iconUrl ?? null
</script>

<template>
  <!-- One screen: the abilities and the insights on the left, the picked ability on the right; a column that runs long scrolls on its own, never the page. -->
  <div class="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
    <div v-if="view === 'pending'" aria-busy="true" class="contents">
      <div class="space-y-2"><USkeleton v-for="row in 5" :key="row" class="h-16 w-full rounded-xl" /></div>
      <USkeleton class="h-96 w-full rounded-2xl" />
    </div>
    <p v-else-if="view === 'error'" class="surface rounded-xl px-4 py-10 text-center text-sm text-muted">{{ t('abilities.failed') }}</p>

    <template v-else>
      <div class="min-h-0 lg:overflow-y-auto">
      <ul class="space-y-1.5" role="listbox" :aria-label="t('abilities.tab')">
        <li v-for="entry in shown" :key="entry.key">
          <button
            type="button"
            role="option"
            :aria-selected="active === entry.key"
            class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors"
            :class="active === entry.key ? 'bg-primary/10 ring-1 ring-inset ring-primary/50' : 'bg-[var(--tm-pane)] hover:bg-accented/60'"
            @mouseenter="active = entry.key"
            @focus="active = entry.key"
            @click="active = entry.key"
          >
            <span class="relative shrink-0">
              <img v-if="iconOf(entry.key)" :src="iconOf(entry.key)!" :alt="entry.name" width="36" height="36" class="size-9 rounded-lg ring-1 ring-default">
              <span v-else class="block size-9 rounded-lg bg-accented" />
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

      </div>

      <article v-if="current" class="surface min-h-0 min-w-0 overflow-y-auto rounded-2xl">
        <AbilityClip :champion-id="championId" :ability="current" :icon-url="iconOf(current.key)" :resource="current.resource ?? championStatic(championId)?.partype ?? null">
          <!-- The champion's insights — strengths, weaknesses, tips — under the clip, where the pane has room for them. -->
          <template #below>
            <ChampionInsights :champion-id="championId" embedded />
          </template>
        </AbilityClip>
      </article>
    </template>
  </div>
</template>
