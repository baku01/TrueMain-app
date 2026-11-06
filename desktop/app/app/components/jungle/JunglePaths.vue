<script setup lang="ts">
import type { Camp, JungleSide, MapSide } from '~/utils/sources/opgg-jungle'
import { readJunglePaths } from '~/utils/sources/opgg-jungle'

/**
 * A jungler's paths as op.gg measures them (`readJunglePaths`): for the side
 * picked, the most run full clear drawn on the Rift — each camp numbered in
 * the order it is taken, the opening one marked — and under it the clears run
 * most, each with its share of the side's games, and the camp clears open on.
 */
const props = defineProps<{ championId: number }>()
const { t } = useT()
const { patch } = useChampionStatics()

const sides = ref<JungleSide[] | null>(null)
watch(() => props.championId, async (championId) => {
  sides.value = null
  const read = await readJunglePaths(championId)
  if (championId === props.championId) sides.value = read
}, { immediate: true })

const sideKey = ref<MapSide>('BLUE')
const side = computed(() => sides.value?.find(entry => entry.side === sideKey.value) ?? sides.value?.[0] ?? null)
/** The clear drawn on the map: the most run, or one picked in the list. */
const picked = ref(0)
watch([() => props.championId, sideKey], () => (picked.value = 0))
const shown = computed(() => side.value?.routes[picked.value] ?? side.value?.routes[0] ?? null)

/**
 * Where each camp stands on the Rift, by side, on a 480-unit square laid over
 * Data Dragon's map (`map11`, the blue base bottom left) — as op.gg draws them.
 */
const POSITION: Record<MapSide, Record<Camp, [number, number]>> = {
  BLUE: { RAPTORS: [225, 315], RED: [250, 360], KRUG: [275, 410], WOLVES: [115, 275], BLUE: [115, 220], GROMP: [70, 210] },
  RED: { RAPTORS: [255, 170], RED: [230, 125], KRUG: [210, 70], WOLVES: [365, 200], BLUE: [365, 265], GROMP: [410, 275] },
}
const points = computed(() => (shown.value && side.value ? shown.value.camps.map(camp => POSITION[side.value!.side][camp]) : []))
const mapUrl = computed(() => (patch.value ? `https://ddragon.leagueoflegends.com/cdn/${patch.value}/img/map/map11.png` : null))
const percent = (share: number) => `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
</script>

<template>
  <section class="surface flex flex-col gap-3 rounded-2xl p-4">
    <header class="flex flex-wrap items-center gap-2">
      <UIcon name="i-tabler-route" class="size-4 text-primary" />
      <h3 class="text-sm font-semibold text-highlighted">{{ t('jungle.tab') }}</h3>
      <span class="text-[11px] text-dimmed">{{ t('jungle.source') }}</span>
      <div v-if="sides?.length" class="ml-auto flex rounded-lg bg-accented/40 p-0.5" role="tablist">
        <button
          v-for="entry in sides"
          :key="entry.side"
          type="button"
          role="tab"
          :aria-selected="side?.side === entry.side"
          class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
          :class="side?.side === entry.side ? (entry.side === 'BLUE' ? 'bg-ally/20 text-ally' : 'bg-enemy/20 text-enemy') : 'text-muted hover:text-highlighted'"
          @click="sideKey = entry.side"
        >
          {{ t(`jungle.side.${entry.side}`) }}
        </button>
      </div>
    </header>

    <div v-if="sides === null" class="grid gap-3 md:grid-cols-[minmax(0,20rem)_1fr]">
      <USkeleton class="aspect-square w-full rounded-xl" />
      <USkeleton class="h-48 w-full rounded-xl" />
    </div>
    <p v-else-if="!side || !shown" class="text-sm text-muted">{{ t('jungle.none') }}</p>
    <div v-else class="grid gap-4 md:grid-cols-[minmax(0,20rem)_1fr]">
      <!-- The clear on the Rift, camp by camp. -->
      <svg viewBox="0 0 480 480" class="aspect-square w-full overflow-hidden rounded-xl bg-accented/30" role="img" :aria-label="shown.camps.map(camp => t(`jungle.camp.${camp}`)).join(' → ')">
        <image v-if="mapUrl" :href="mapUrl" x="0" y="0" width="480" height="480" opacity="0.55" />
        <polyline :points="points.map(point => point.join(',')).join(' ')" fill="none" stroke="var(--ui-primary)" stroke-width="3" stroke-dasharray="6 5" stroke-linejoin="round" opacity="0.9" />
        <g v-for="(point, index) in points" :key="index">
          <title>{{ index + 1 }}. {{ t(`jungle.camp.${shown.camps[index]}`) }}</title>
          <circle :cx="point[0]" :cy="point[1]" r="15" :fill="index === 0 ? 'var(--ui-primary)' : 'var(--ui-bg-elevated)'" stroke="var(--ui-primary)" stroke-width="2" />
          <text :x="point[0]" :y="point[1] + 5" text-anchor="middle" font-size="14" font-weight="700" :fill="index === 0 ? 'var(--ui-bg)' : 'var(--ui-text-highlighted)'">{{ index + 1 }}</text>
          <g v-if="index === 0" :transform="`translate(${point[0]}, ${point[1] + 26})`">
            <rect x="-22" y="-10" width="44" height="18" rx="9" fill="var(--ui-primary)" />
            <text y="3" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ui-bg)">{{ t('jungle.start') }}</text>
          </g>
        </g>
      </svg>

      <div class="flex min-w-0 flex-col gap-3">
        <div>
          <p class="stat-label mb-1.5">{{ t('jungle.routes') }} · {{ t('jungle.games', { count: compact.format(side.games) }) }}</p>
          <ol class="flex flex-col gap-1">
            <li v-for="(route, index) in side.routes.slice(0, 5)" :key="route.camps.join()">
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors"
                :class="index === picked ? 'bg-primary/12 ring-1 ring-primary/50' : 'hover:bg-accented/40'"
                @click="picked = index"
              >
                <span class="w-10 shrink-0 text-sm font-bold tabular-nums" :class="index === picked ? 'text-primary' : 'text-highlighted'">{{ percent(route.share) }}</span>
                <span class="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-muted">
                  <template v-for="(camp, step) in route.camps" :key="step">
                    <UIcon v-if="step > 0" name="i-lucide-chevron-right" class="size-3 text-dimmed" aria-hidden="true" />
                    <span :class="step === 0 ? 'font-semibold text-highlighted' : ''">{{ t(`jungle.camp.${camp}`) }}</span>
                  </template>
                </span>
              </button>
            </li>
          </ol>
        </div>
        <div>
          <p class="stat-label mb-1.5">{{ t('jungle.starts') }}</p>
          <div class="flex flex-wrap gap-1.5">
            <span v-for="start in side.starts.filter(entry => entry.share >= 0.01)" :key="start.camp" class="rounded-md bg-accented/40 px-2 py-1 text-xs">
              <span class="font-semibold text-highlighted">{{ t(`jungle.camp.${start.camp}`) }}</span>
              <span class="ml-1 tabular-nums text-muted">{{ percent(start.share) }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
