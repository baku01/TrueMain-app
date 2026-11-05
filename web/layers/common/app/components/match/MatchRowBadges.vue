<script setup lang="ts">
import type { MatchBadge, MatchBadgeKind } from '#shared/types/matches'

const { t } = useT()

// The game's standouts as Blitz tags them on a match — "Top damage", "CS
// master"… — one pill each, its tooltip saying why the game earned it (the
// measure, and the bar it cleared). Gold for the rarer tier (the MVP crown's
// token), the primary tint for the rest. The pills wrap over two lines at most
// and whatever does not fit is clipped: the host orders them rarest first.
const props = defineProps<{
  badges: MatchBadge[]
}>()

interface BadgeLook { icon: string, gold: boolean }

const LOOK: Record<MatchBadgeKind, BadgeLook> = {
  pentaKill: { icon: 'i-lucide-swords', gold: true },
  quadraKill: { icon: 'i-lucide-swords', gold: true },
  tripleKill: { icon: 'i-lucide-swords', gold: false },
  topDamage: { icon: 'i-lucide-flame', gold: true },
  teamDamage: { icon: 'i-lucide-flame', gold: false },
  topGold: { icon: 'i-lucide-coins', gold: true },
  csGod: { icon: 'i-lucide-wheat', gold: true },
  csLegend: { icon: 'i-lucide-wheat', gold: false },
  csMaster: { icon: 'i-lucide-wheat', gold: false },
  unkillable: { icon: 'i-lucide-shield', gold: true },
  allSeeing: { icon: 'i-lucide-eye', gold: true },
  goodEye: { icon: 'i-lucide-eye', gold: false },
}

const pills = computed(() => props.badges.map((badge) => {
  const look = LOOK[badge.kind]
  const value = badge.value?.toLocaleString()
  return {
    kind: badge.kind,
    icon: look.icon,
    label: t(`match.badge.${badge.kind}`),
    tip: t(`match.badge.${badge.kind}.tip`, { value: value ?? '', target: badge.target ?? '' }),
    tone: look.gold ? 'bg-gold/12 text-gold ring-gold/25' : 'bg-primary/10 text-primary ring-primary/20',
  }
}))
</script>

<template>
  <ul class="flex max-h-[42px] flex-wrap content-center gap-1 overflow-hidden">
    <li v-for="pill in pills" :key="pill.kind">
      <UTooltip :text="pill.tip" :content="{ side: 'top' }">
        <span
          class="flex h-[19px] cursor-help items-center gap-1 rounded-full px-2 text-[10.5px] font-semibold whitespace-nowrap ring-1 ring-inset"
          :class="pill.tone"
          :aria-label="`${pill.label}: ${pill.tip}`"
        >
          <UIcon :name="pill.icon" class="size-3" aria-hidden="true" />
          {{ pill.label }}
        </span>
      </UTooltip>
    </li>
  </ul>
</template>
