<script setup lang="ts">
import type { MatchBadge } from '#shared/types/matches'
import type { BadgeTier } from '#common/utils/match-badges'
import { BADGE_LOOK } from '#common/utils/match-badges'

const { t } = useT()

// The game's accolades as Blitz draws them on a match: a pill edged in its
// tier's colour (gold, silver, bronze, or blue for the losing side's best),
// a round medallion with the icon across its left edge, and a tooltip naming
// it and saying why the game earned it. The first `shown` (the host orders
// them heaviest first); the rest fold into a "+N" pill whose tooltip lists them.
const props = withDefaults(defineProps<{
  badges: MatchBadge[]
  shown?: number
}>(), { shown: 3 })

/** The tiers' colours: the app's own gold and primary, Blitz's silver and bronze. */
const TIER_COLOR: Record<BadgeTier, string> = {
  gold: 'var(--color-gold)',
  silver: '#bfbfbf',
  bronze: '#c79460',
  blue: 'var(--ui-primary)',
}

const pills = computed(() => props.badges.map((badge) => {
  const look = BADGE_LOOK[badge.kind]
  return {
    kind: badge.kind,
    icon: look.icon,
    color: TIER_COLOR[look.tier],
    label: t(`match.badge.${badge.kind}`),
    tip: t(`match.badge.${badge.kind}.tip`, { value: badge.value?.toLocaleString() ?? '', target: badge.target?.toLocaleString() ?? '' }),
  }
}))
const visible = computed(() => pills.value.slice(0, props.shown))
const hidden = computed(() => pills.value.slice(props.shown))
</script>

<template>
  <ul class="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-2.5">
    <li v-for="pill in visible" :key="pill.kind">
      <UTooltip :content="{ side: 'top' }">
        <span class="badge-pill pl-[1.375rem]" :style="{ '--badge': pill.color }" :aria-label="`${pill.label}: ${pill.tip}`">
          <span class="badge-medal" aria-hidden="true">
            <UIcon :name="pill.icon" class="size-3" />
          </span>
          <span class="relative z-[2]">{{ pill.label }}</span>
        </span>
        <template #content>
          <div class="max-w-64 space-y-0.5 px-1 py-0.5">
            <p class="text-sm font-semibold text-highlighted">{{ pill.label }}</p>
            <p class="text-xs text-muted">{{ pill.tip }}</p>
          </div>
        </template>
      </UTooltip>
    </li>
    <li v-if="hidden.length">
      <UTooltip :content="{ side: 'top' }">
        <span class="badge-pill -ml-2 px-2" :style="{ '--badge': hidden[0]!.color }">
          <span class="relative z-[2]">{{ t('match.badge.more', { count: hidden.length }) }}</span>
        </span>
        <template #content>
          <ul class="max-w-64 space-y-1.5 px-1 py-0.5">
            <li v-for="pill in hidden" :key="pill.kind">
              <p class="text-sm font-semibold text-highlighted">{{ pill.label }}</p>
              <p class="text-xs text-muted">{{ pill.tip }}</p>
            </li>
          </ul>
        </template>
      </UTooltip>
    </li>
  </ul>
</template>

<style scoped>
/* Blitz's accolade: a 1 px edge in the tier's colour, brighter at the top
   right, over a faint wash of it; the medallion straddles the left edge. */
.badge-pill {
  position: relative;
  display: flex;
  align-items: center;
  height: 1.5rem;
  padding-right: 0.5rem;
  border-radius: 5px;
  font-size: 0.6875rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: help;
  color: var(--badge);
  background: linear-gradient(208deg, color-mix(in oklab, var(--badge) 60%, transparent), color-mix(in oklab, var(--badge) 20%, transparent) 65%);
  text-shadow: 0 1px 0 rgb(0 0 0 / 0.5);
}
.badge-pill::before,
.badge-pill::after {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: 4px;
  z-index: 1;
}
.badge-pill::before { background: var(--ui-bg); }
.badge-pill::after { background: linear-gradient(29deg, color-mix(in oklab, var(--badge) 17%, transparent), color-mix(in oklab, var(--badge) 6%, transparent)); }

.badge-medal {
  position: absolute;
  top: 50%;
  left: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.375rem;
  aspect-ratio: 1;
  border-radius: 9999px;
  translate: -30% -50%;
  color: var(--ui-bg);
  background: linear-gradient(to bottom, var(--badge), color-mix(in oklab, var(--badge) 45%, transparent), var(--badge));
  box-shadow: inset 0 0 0 2px color-mix(in oklab, var(--ui-bg) 60%, transparent), 0 0 6px rgb(0 0 0 / 0.5);
}
</style>
