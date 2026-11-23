<script setup lang="ts">
import type { NerdReport } from '~/utils/nerd-stats/analysis'
import type { CoachPillar } from '~/utils/nerd-stats/coach'
import { POSITION_BY_VALUE } from '#common/utils/positions'
import { buildCoachReport } from '~/utils/nerd-stats/coach'

/**
 * Plain-language coaching summary: combines the player's biggest win-rate
 * levers, champion pool, best lane, game pace, and tilt/session habits into
 * concrete takeaways without statistical jargon.
 */
const props = defineProps<{ report: NerdReport }>()

const { t } = useT()
const f = useNerdFormat()
const champions = useStaticChampionsById()

const coach = computed(() => buildCoachReport(props.report))

const PILLAR_ICONS: Record<CoachPillar, string> = {
  survive: 'i-tabler-shield-heart',
  lane: 'i-tabler-swords',
  farm: 'i-tabler-coins',
  fight: 'i-tabler-users-group',
  damage: 'i-tabler-flame',
  vision: 'i-tabler-eye',
}

function champInfo(key: string) {
  const champ = champions.value.get(Number(key))
  return { name: champ?.name ?? `#${key}`, iconUrl: champ?.iconUrl ?? '' }
}

function posInfo(key: string) {
  const pos = POSITION_BY_VALUE.get(key)
  return { label: pos?.label ?? key, iconUrl: pos?.iconUrl ?? '' }
}
</script>

<template>
  <section class="surface rounded-lg">
    <NerdCardHeader
      icon="i-tabler-bulb"
      :title="t('nerd.coach.title')"
      :subtitle="t('nerd.coach.subtitle', { count: report.overview.games })"
    />

    <div class="space-y-5 p-4">
      <!-- Top actionable levers -->
      <div v-if="coach.levers.length" class="space-y-2.5">
        <p class="stat-label">{{ t('nerd.coach.leversTitle') }}</p>
        <div class="grid gap-3 lg:grid-cols-3">
          <article v-for="(lever, index) in coach.levers" :key="lever.pillar" class="coach-card flex flex-col justify-between gap-3">
            <div class="space-y-2">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                    <UIcon :name="PILLAR_ICONS[lever.pillar]" class="size-4" />
                  </span>
                  <div class="min-w-0">
                    <p class="text-[10.5px] font-semibold uppercase tracking-wide text-dimmed">
                      {{ t('nerd.coach.priority', { rank: index + 1 }) }} · {{ t(`nerd.coach.pillar.${lever.pillar}`) }}
                    </p>
                    <h3 class="truncate text-sm font-semibold text-highlighted">
                      {{ t(`nerd.metric.${lever.entry.definition.key}`) }}
                    </h3>
                  </div>
                </div>
                <span class="shrink-0 rounded-full bg-(--nerd-win)/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-(--nerd-win)">
                  +{{ Math.round(lever.gap * 100) }}%
                </span>
              </div>

              <!-- Visual win-rate comparison bar -->
              <div class="space-y-1.5 pt-0.5 text-xs">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-muted">{{ t('nerd.coach.whenGood') }}</span>
                  <span class="font-semibold tabular-nums text-(--nerd-win)">{{ f.percent(lever.goodRate) }}</span>
                </div>
                <div class="h-1.5 overflow-hidden rounded-full bg-accented/70">
                  <div class="h-full rounded-full bg-(--nerd-win)" :style="{ width: `${Math.round(lever.goodRate * 100)}%` }" />
                </div>
                <div class="flex items-center justify-between gap-2 pt-0.5">
                  <span class="text-muted">{{ t('nerd.coach.whenBad') }}</span>
                  <span class="font-semibold tabular-nums text-(--nerd-loss)">{{ f.percent(lever.badRate) }}</span>
                </div>
                <div class="h-1.5 overflow-hidden rounded-full bg-accented/70">
                  <div class="h-full rounded-full bg-(--nerd-loss)" :style="{ width: `${Math.round(lever.badRate * 100)}%` }" />
                </div>
              </div>

              <!-- Concrete real-game averages -->
              <p class="text-xs tabular-nums text-muted">
                {{ t('nerd.coach.winVsLoss', { win: f.metric(lever.entry.definition, lever.winMean), loss: f.metric(lever.entry.definition, lever.lossMean) }) }}
              </p>
            </div>

            <!-- Practical tip + target -->
            <div class="rounded-md bg-elevated/70 p-2.5 text-xs leading-relaxed">
              <p class="font-medium text-highlighted">
                {{ t(lever.higherIsBetter ? 'nerd.coach.targetAbove' : 'nerd.coach.targetBelow', { value: f.metric(lever.entry.definition, lever.winMean) }) }}
              </p>
              <p class="mt-0.5 text-muted">{{ t(`nerd.coach.tip.${lever.pillar}`) }}</p>
            </div>
          </article>
        </div>
      </div>

      <!-- Choices, pace, and routine synthesis -->
      <div class="grid gap-3 md:grid-cols-2">
        <!-- Champion pool -->
        <article v-if="coach.champions.climb.length || coach.champions.avoid.length" class="coach-card space-y-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-tabler-crown" class="size-4 text-primary" />
            <h3 class="text-sm font-semibold text-highlighted">{{ t('nerd.coach.championsTitle') }}</h3>
          </div>
          <div v-if="coach.champions.climb.length" class="space-y-1.5">
            <p class="text-[11px] font-medium text-(--nerd-win)">{{ t('nerd.coach.championsClimb') }}</p>
            <div class="flex flex-wrap gap-2">
              <div v-for="champ in coach.champions.climb" :key="champ.key" class="flex items-center gap-2 rounded-md bg-elevated/70 px-2.5 py-1.5 text-xs">
                <img v-if="champInfo(champ.key).iconUrl" :src="champInfo(champ.key).iconUrl" :alt="champInfo(champ.key).name" class="size-6 rounded-md object-cover">
                <div>
                  <p class="font-medium text-highlighted">{{ champInfo(champ.key).name }}</p>
                  <p class="text-[11px] tabular-nums text-muted">{{ f.percent(champ.raw.rate) }} · {{ t('nerd.coach.gamesShort', { count: champ.games }) }}</p>
                </div>
              </div>
            </div>
          </div>
          <div v-if="coach.champions.avoid.length" class="space-y-1.5">
            <p class="text-[11px] font-medium text-(--nerd-loss)">{{ t('nerd.coach.championsAvoid') }}</p>
            <div class="flex flex-wrap gap-2">
              <div v-for="champ in coach.champions.avoid" :key="champ.key" class="flex items-center gap-2 rounded-md bg-elevated/70 px-2.5 py-1.5 text-xs">
                <img v-if="champInfo(champ.key).iconUrl" :src="champInfo(champ.key).iconUrl" :alt="champInfo(champ.key).name" class="size-6 rounded-md object-cover">
                <div>
                  <p class="font-medium text-highlighted">{{ champInfo(champ.key).name }}</p>
                  <p class="text-[11px] tabular-nums text-muted">{{ f.percent(champ.raw.rate) }} · {{ t('nerd.coach.gamesShort', { count: champ.games }) }}</p>
                </div>
              </div>
            </div>
          </div>
        </article>

        <!-- Lane & game pace & routine -->
        <div class="grid content-start gap-3">
          <article v-if="coach.positions" class="coach-card flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <img v-if="posInfo(coach.positions.best.key).iconUrl" :src="posInfo(coach.positions.best.key).iconUrl" :alt="posInfo(coach.positions.best.key).label" class="size-7 shrink-0 object-contain">
              <div class="min-w-0">
                <p class="text-[11px] font-medium text-dimmed">{{ t('nerd.coach.bestLane') }}</p>
                <p class="text-sm font-semibold text-highlighted">
                  {{ posInfo(coach.positions.best.key).label }}
                  <span class="ml-1 text-xs font-semibold tabular-nums text-(--nerd-win)">{{ f.percent(coach.positions.best.raw.rate) }}</span>
                </p>
                <p v-if="coach.positions.worst" class="text-xs text-muted">
                  {{ t('nerd.coach.worstLane', { lane: posInfo(coach.positions.worst.key).label, rate: f.percent(coach.positions.worst.raw.rate) }) }}
                </p>
              </div>
            </div>
          </article>

          <article v-if="coach.pace" class="coach-card space-y-1">
            <div class="flex items-center gap-2">
              <UIcon name="i-tabler-clock-hour-4" class="size-4 text-primary" />
              <h3 class="text-sm font-semibold text-highlighted">{{ t(`nerd.coach.pace.${coach.pace.kind}.title`) }}</h3>
            </div>
            <p class="text-xs leading-relaxed text-muted">
              {{ t(`nerd.coach.pace.${coach.pace.kind}.body`, { best: f.percent(coach.pace.bestRate), worst: f.percent(coach.pace.worstRate) }) }}
            </p>
          </article>

          <article v-if="coach.routine.tiltDrop || coach.routine.fatigueDrop" class="coach-card space-y-1.5">
            <div class="flex items-center gap-2">
              <UIcon name="i-tabler-flame-off" class="size-4 text-(--nerd-loss)" />
              <h3 class="text-sm font-semibold text-highlighted">{{ t('nerd.coach.routineTitle') }}</h3>
            </div>
            <p v-if="coach.routine.tiltDrop" class="text-xs leading-relaxed text-muted">
              {{ t('nerd.coach.tiltBody', { win: f.percent(coach.routine.tiltDrop.afterWin), loss: f.percent(coach.routine.tiltDrop.afterLoss) }) }}
            </p>
            <p v-if="coach.routine.fatigueDrop" class="text-xs leading-relaxed text-muted">
              {{ t('nerd.coach.fatigueBody', { early: f.percent(coach.routine.fatigueDrop.earlyRate), late: f.percent(coach.routine.fatigueDrop.lateRate) }) }}
            </p>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.coach-card {
  border-radius: 0.5rem;
  padding: 0.875rem;
  background: color-mix(in oklch, var(--ui-bg-elevated) 55%, transparent);
  box-shadow: inset 0 0 0 1px var(--ui-border);
}
</style>
