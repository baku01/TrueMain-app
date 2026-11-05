<script setup lang="ts">
import type { MatchBadge, MatchBadgeKind } from '#shared/types/matches'

const { t } = useT()

// The game's standouts as Blitz tags them on a match — "Top damage", "CS
// master"… — one pill each, the measure behind it in the tooltip. Gold for the
// rarer tier (the MVP crown's token), the primary tint for the rest. The pills
// wrap over two lines at most and whatever does not fit is clipped: the host
// orders them rarest first.
const props = defineProps<{
  badges: MatchBadge[]
}>()

interface BadgeLook { icon: string, gold: boolean, tip?: string }

const LOOK: Record<MatchBadgeKind, BadgeLook> = {
  pentaKill: { icon: 'i-lucide-swords', gold: true },
  quadraKill: { icon: 'i-lucide-swords', gold: true },
  tripleKill: { icon: 'i-lucide-swords', gold: false },
  topDamage: { icon: 'i-lucide-flame', gold: true, tip: 'match.badge.topDamage.tip' },
  teamDamage: { icon: 'i-lucide-flame', gold: false, tip: 'match.badge.teamDamage.tip' },
  topGold: { icon: 'i-lucide-coins', gold: true, tip: 'match.badge.topGold.tip' },
  csGod: { icon: 'i-lucide-wheat', gold: true, tip: 'match.badge.cs.tip' },
  csLegend: { icon: 'i-lucide-wheat', gold: false, tip: 'match.badge.cs.tip' },
  csMaster: { icon: 'i-lucide-wheat', gold: false, tip: 'match.badge.cs.tip' },
  unkillable: { icon: 'i-lucide-shield', gold: true, tip: 'match.badge.unkillable.tip' },
  allSeeing: { icon: 'i-lucide-eye', gold: true, tip: 'match.badge.vision.tip' },
  goodEye: { icon: 'i-lucide-eye', gold: false, tip: 'match.badge.vision.tip' },
}

const pills = computed(() => props.badges.map((badge) => {
  const look = LOOK[badge.kind]
  const value = badge.value?.toLocaleString()
  return {
    kind: badge.kind,
    icon: look.icon,
    label: t(`match.badge.${badge.kind}`),
    tip: look.tip ? t(look.tip, { value: value ?? '' }) : undefined,
    tone: look.gold ? 'bg-gold/12 text-gold ring-gold/25' : 'bg-primary/10 text-primary ring-primary/20',
  }
}))
</script>

<template>
  <ul class="flex max-h-[42px] flex-wrap content-center gap-1 overflow-hidden">
    <li
      v-for="pill in pills"
      :key="pill.kind"
      class="flex h-[19px] items-center gap-1 rounded-full px-2 text-[10.5px] font-semibold whitespace-nowrap ring-1 ring-inset"
      :class="pill.tone"
      :title="pill.tip"
    >
      <UIcon :name="pill.icon" class="size-3" aria-hidden="true" />
      {{ pill.label }}
    </li>
  </ul>
</template>
