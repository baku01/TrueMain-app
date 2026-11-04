<script setup lang="ts">
import type { AbilityData } from '~/utils/ability-data'
import { perRank } from '~/utils/ability-data'
import { clipUrl, posterUrl } from '~/utils/ability-clips'

/**
 * One ability, whole, as Blitz shows it: Riot's clip of it playing — the one
 * leagueoflegends.com plays on its champion pages, mp4 first for the macOS
 * webview, webm after —, then the game's own description with every figure
 * in it (`utils/ability-data.ts`, read from the live game data), and its
 * cooldown, cost, range and charges rank by rank.
 */
const props = defineProps<{
  championId: number
  ability: AbilityData
  iconUrl?: string | null
  /** The resource its cost is paid in (`Mana`, `Energia`), when the ability's data does not say. */
  resource?: string | null
  /** A tooltip's size: the clip over the text, smaller type, no icon. */
  compact?: boolean
}>()

const { t } = useT()
const COLORS: Record<string, string> = { P: 'text-muted', Q: 'text-toned', W: 'text-toned', E: 'text-toned', R: 'text-primary' }
const clip = computed(() => clipUrl(props.championId, props.ability.key))
const poster = computed(() => posterUrl(props.championId, props.ability.key))
const failed = ref(false)
watch(() => `${props.championId}-${props.ability.key}`, () => (failed.value = false))

/** The figures rank by rank, the rows the ability has: no cost row for a free one, no charges for one without. */
const rows = computed(() => {
  const ability = props.ability
  const list: { label: string, values: number[], unit: string }[] = []
  const has = (values: number[]) => values.length > 0 && values.some(value => value > 0)
  if (has(ability.cooldown)) list.push({ label: t('abilities.cooldown'), values: ability.cooldown, unit: 's' })
  const resource = ability.resource ?? props.resource
  if (has(ability.cost)) list.push({ label: resource ? `${t('abilities.cost')} (${resource})` : t('abilities.cost'), values: ability.cost, unit: '' })
  if (has(ability.range)) list.push({ label: t('abilities.range'), values: ability.range, unit: '' })
  if (ability.ammo && has(ability.ammo.max)) {
    list.push({ label: t('abilities.charges'), values: ability.ammo.max, unit: '' })
    if (has(ability.ammo.recharge)) list.push({ label: t('abilities.recharge'), values: ability.ammo.recharge, unit: 's' })
  }
  return list
})
const rankCount = computed(() => Math.max(1, props.ability.maxRank))
</script>

<template>
  <!-- The clip beside the text where the pane is wide enough, over it where it is not. -->
  <div :class="compact ? '' : '@container'">
  <div class="grid" :class="compact ? '' : '@2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @2xl:items-start'">
    <!-- The clip, and under it what the page puts there (the insights), beside the text on a wide pane. -->
    <div class="min-w-0 @2xl:p-4">
      <div class="relative aspect-video bg-black @2xl:overflow-hidden @2xl:rounded-xl">
        <video v-if="!failed" :key="`${championId}-${ability.key}`" :src="clip" :poster="poster" autoplay muted loop playsinline preload="auto" class="size-full object-cover" @error="failed = true" />
        <div v-else class="grid size-full place-items-center text-sm text-muted">{{ t('abilities.noClip') }}</div>
        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
      </div>
      <div v-if="$slots.below" class="p-5 pt-4 @2xl:px-0 @2xl:pb-0">
        <slot name="below" />
      </div>
    </div>
    <div :class="compact ? 'space-y-2.5 p-3' : 'space-y-4 p-5 @2xl:pl-1'">
      <header class="flex items-center gap-3">
        <img v-if="iconUrl && !compact" :src="iconUrl" alt="" width="40" height="40" class="size-10 rounded-lg ring-1 ring-default">
        <div class="min-w-0">
          <h2 class="flex items-center gap-2 font-semibold text-highlighted" :class="compact ? 'text-sm' : 'text-lg'">
            {{ ability.name }}
            <span class="rounded bg-accented px-1.5 py-0.5 text-xs font-extrabold" :class="COLORS[ability.key]">{{ ability.key === 'P' ? t('abilities.passive') : ability.key }}</span>
          </h2>
          <p v-if="ability.key !== 'P'" class="text-xs text-muted">{{ t('abilities.ranks', { count: rankCount }) }}</p>
        </div>
      </header>

      <!-- The game's own text, its figures filled in; the HTML is built from escaped text and the game's tags only (`safeDescription`). -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <p class="ability-text leading-relaxed text-toned" :class="compact ? 'text-xs' : 'text-sm'" v-html="ability.html" />

      <div v-if="rows.length" class="overflow-x-auto">
        <table class="w-full" :class="compact ? 'text-xs' : 'text-sm'">
          <thead>
            <tr class="stat-label">
              <th class="pb-2 text-left font-medium" />
              <th v-for="rank in rankCount" :key="rank" class="pb-2 text-right font-medium tabular-nums">{{ t('abilities.rank', { rank }) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.label" class="border-t border-default/60">
              <th class="py-1.5 pr-4 text-left font-medium text-muted">{{ row.label }}</th>
              <td v-for="rank in rankCount" :key="rank" class="py-1.5 text-right font-semibold tabular-nums text-highlighted">
                {{ row.values[rank - 1] !== undefined ? `${perRank([row.values[rank - 1]!])}${row.unit}` : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
/* The game's tooltip colours, by the tag the description wraps a figure in. */
.ability-text :deep(.ab-physical) { color: #f0913a; font-weight: 600; }
.ability-text :deep(.ab-magic) { color: #4fb4f0; font-weight: 600; }
.ability-text :deep(.ab-true) { color: #f2f2f2; font-weight: 600; }
.ability-text :deep(.ab-heal), .ability-text :deep(.ab-health) { color: #5fd18a; font-weight: 600; }
.ability-text :deep(.ab-shield) { color: #c9d4e3; font-weight: 600; }
.ability-text :deep(.ab-status), .ability-text :deep(.ab-keyword) { color: var(--ui-text-highlighted); font-weight: 600; }
.ability-text :deep(.ab-speed) { color: #e9d27a; font-weight: 600; }
.ability-text :deep(.ab-recast), .ability-text :deep(.ab-spellname) { color: var(--ui-primary); font-weight: 600; }
.ability-text :deep(.ab-ad) { color: #f0913a; }
.ability-text :deep(.ab-ap) { color: #b48df2; }
.ability-text :deep(.ab-armor) { color: #e9b06a; }
.ability-text :deep(.ab-mr) { color: #6ad3e9; }
.ability-text :deep(.ab-attention) { color: var(--ui-text-highlighted); }
.ability-text :deep(.ab-rules) { color: var(--ui-text-dimmed); font-style: italic; }
</style>
