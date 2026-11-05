<script setup lang="ts">
import { teamDamage } from '~/utils/damage-profile'

/**
 * Each team's damage split, as Blitz shows it in champion select: our team and
 * the enemy's side by side, each a row of three tinted pills — physical, magic,
 * true — as wide as their share, the share inside when there is room for it.
 * The split is the picks' measured damage to champions added up (each champion
 * weighs what it deals per game: `teamDamage`), so a carry counts for more
 * than a support. A team past 65% of one kind says so under its pills.
 */
const props = defineProps<{
  allies: { championId: number, position: string | null }[]
  enemies: { championId: number, position: string | null }[]
}>()

const { t } = useT()
const { profileOf } = useDamageProfiles()

const KINDS = [
  { key: 'physical', share: 'physicalShare', color: 'var(--color-stat-ad)', label: 'AD', min: 0.15 },
  { key: 'magic', share: 'magicShare', color: 'var(--color-stat-ap)', label: 'AP', min: 0.15 },
  { key: 'true', share: 'trueShare', color: 'var(--color-stat-true)', label: 'True', min: 0.2 },
] as const

/** Past this share of one kind, the team leans on it. */
const ONE_SIDED = 0.65

const teams = computed(() => ([
  { key: 'ally', title: t('damage.meter.ally'), picks: props.allies },
  { key: 'enemy', title: t('damage.meter.enemy'), picks: props.enemies },
]).map((team) => {
  const damage = teamDamage(team.picks.map(pick => profileOf(pick.championId, pick.position)))
  const pills = KINDS.map(kind => ({ ...kind, value: damage ? damage[kind.share] : 1 / 3 }))
  const lean = damage ? pills.find(pill => pill.value > ONE_SIDED) ?? null : null
  return { ...team, damage, pills, lean }
}))

const percent = (value: number) => `${Math.round(value * 100)}%`
</script>

<template>
  <div class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
    <div v-for="team in teams" :key="team.key" class="flex min-w-0 flex-col gap-1.5">
      <p class="flex items-center gap-1.5 text-xs font-medium text-muted">
        {{ team.title }}
        <span v-if="team.damage?.unmeasured" class="text-dimmed">· {{ t('damage.meter.unmeasured', { count: team.damage.unmeasured }) }}</span>
      </p>
      <div class="flex h-7 gap-1" :class="!team.damage && 'opacity-50'">
        <span
          v-for="pill in team.pills"
          :key="pill.key"
          class="flex min-w-0 items-center justify-center overflow-hidden rounded-lg px-2 text-[11px] font-semibold tabular-nums whitespace-nowrap"
          :style="{
            width: `${pill.value * 100}%`,
            color: pill.color,
            background: `color-mix(in oklab, ${pill.color} 12%, transparent)`,
            border: `1px solid color-mix(in oklab, ${pill.color} 30%, transparent)`,
          }"
          :title="`${t(`damage.meter.${pill.key}`)}: ${percent(pill.value)}`"
        >
          <template v-if="team.damage && pill.value > 0.06">{{ percent(pill.value) }}<template v-if="pill.value > pill.min">&nbsp;{{ pill.label }}</template></template>
        </span>
      </div>
      <p
        v-if="team.lean"
        class="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium"
        :style="{ color: team.lean.color, background: `color-mix(in oklab, ${team.lean.color} 10%, transparent)` }"
      >
        <UIcon name="i-lucide-triangle-alert" class="size-3.5" />
        {{ t('damage.meter.lean', { share: percent(team.lean.value), kind: t(`damage.meter.kind.${team.lean.key}`) }) }}
      </p>
    </div>
  </div>
</template>
