<script setup lang="ts">
import type { NerdReport, MetricAssociation } from '~/utils/nerd-stats/analysis'
import type { GameRow } from '~/utils/nerd-stats/features'
import type { GameSource } from '~/utils/deep-history'
import { isFew, metricSplit, overviewVerdict } from '~/utils/nerd-stats/insights'

/**
 * The page's headline, said plainly first: how often the player wins, where
 * their true rate most likely sits — drawn as a band on a 0–100% track, a
 * coin flip at its middle — and whether that is above, below or not yet told
 * apart from 50%, with how sure; the game length of wins and losses, the KDA,
 * the LP the rank history measured and the streaks; what comes most with the
 * wins and with the losses, each as the win rate on either side of it
 * (effects whose interval excludes zero, the result's own consequences left
 * out); and every game in order (`NerdRibbon`). While the history is still
 * being read back, a bar says how far it has got, and a line where its games
 * came from — the client, Blitz, this computer.
 */
const props = defineProps<{
  report: NerdReport | null
  rows: GameRow[]
  /** Games read so far, every queue. */
  total: number
  ceiling: number
  reading: boolean
  paused: boolean
  /** How many of the games each source gave (`useDeepHistory`). */
  sources: Record<GameSource, number>
  phase: 'idle' | 'client' | 'blitz' | 'done'
  /** Blitz match ids still to read. */
  queued: number
  blitzMissing: boolean
}>()
defineEmits<{ toggleReading: [] }>()

const { t } = useT()
const f = useNerdFormat()
const say = useNerdSay()

const overview = computed(() => props.report?.overview ?? null)
const verdict = computed(() => (overview.value ? overviewVerdict(overview.value) : null))
const headline = computed(() => {
  const o = overview.value
  if (!o || !verdict.value) return ''
  return t(`nerd.hero.say.${verdict.value.verdict}`, { rate: f.percent(o.rate), games: o.games, wins: o.wins, low: f.percent(o.low), high: f.percent(o.high) })
})
const headlineDetail = computed(() => (overview.value ? t('nerd.hero.intervalLine', { low: f.percent(overview.value.low, 1), high: f.percent(overview.value.high, 1), p: f.pValue(overview.value.pVersusHalf) }) : ''))

/** The strongest effects either way among what the player does — not what winning produces. */
const factors = computed(() => {
  const candidates = (props.report?.metrics ?? []).filter(entry => entry.definition.timing !== 'outcome' && entry.effect)
  const best = candidates.filter(entry => entry.effect!.low > 0).sort((a, b) => b.effect!.d - a.effect!.d)[0] ?? null
  const worst = candidates.filter(entry => entry.effect!.high < 0).sort((a, b) => a.effect!.d - b.effect!.d)[0] ?? null
  return { best, worst }
})
const factorLine = (entry: MetricAssociation) => say.split(entry) ?? t('nerd.hero.factorMeans', { win: f.metric(entry.definition, entry.effect!.meanA), loss: f.metric(entry.definition, entry.effect!.meanB) })
const factorConfidence = (entry: MetricAssociation) => metricSplit(entry)?.confidence ?? 'uncertain'

/** The sources that gave any game, in reading order. */
const sourceParts = computed(() => (['client', 'blitz', 'saved'] as const).filter(source => props.sources[source] > 0).map(source => ({ source, count: props.sources[source] })))
const SOURCE_ICONS: Record<GameSource, string> = { client: 'i-tabler-device-desktop', blitz: 'i-tabler-cloud-download', saved: 'i-tabler-database' }

const lp = computed(() => props.report?.lp ?? null)
const streak = computed(() => props.report?.sequence.streaks ?? null)
</script>

<template>
  <section class="nerd-hero surface relative isolate overflow-hidden rounded-lg">
    <div class="nerd-hero-glow" aria-hidden="true" />
    <p class="nerd-hero-watermark" aria-hidden="true"><NerdMath :text="`P(${t('nerd.symbol.win')}) = σ(β₀ + Σ βᵢ·zᵢ)`" /></p>

    <div class="relative grid gap-6 p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.05fr)]">
      <!-- The win rate and how sure it is. -->
      <div v-if="overview" class="min-w-0">
        <p class="stat-label">{{ t('nerd.hero.winRate', { count: overview.games }) }}</p>
        <div class="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
          <span class="font-display text-6xl font-semibold leading-none tracking-tight text-highlighted">{{ f.percent(overview.rate, 1) }}</span>
          <p class="mb-1 flex items-center gap-4 text-sm">
            <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-(--nerd-win)" /><b class="font-semibold text-highlighted">{{ overview.wins }}</b> <span class="text-muted">{{ t('nerd.wins') }}</span></span>
            <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-(--nerd-loss)" /><b class="font-semibold text-highlighted">{{ overview.losses }}</b> <span class="text-muted">{{ t('nerd.losses') }}</span></span>
          </p>
        </div>
        <!-- The likely range on a 0–100% track, a coin flip marked at its middle. -->
        <div class="relative mt-4 h-3 rounded-full bg-accented/70" role="img" :aria-label="t('nerd.hero.interval', { low: f.percent(overview.low, 1), high: f.percent(overview.high, 1) })">
          <div class="nerd-grow absolute inset-y-0 rounded-full bg-(--nerd-win)/35" :style="{ left: `${overview.low * 100}%`, width: `${(overview.high - overview.low) * 100}%` }" />
          <div class="absolute inset-y-[-4px] left-1/2 w-0.5 rounded-full bg-(--ui-text-dimmed)" />
          <div class="absolute top-1/2 size-3.5 -translate-1/2 rounded-full bg-(--nerd-win) ring-2 ring-(--tm-pane)" :style="{ left: `${overview.rate * 100}%` }" />
        </div>
        <div class="mt-1 flex justify-between text-[10px] tabular-nums text-dimmed">
          <span>0%</span><span>{{ t('nerd.ref.coinShort') }}</span><span>100%</span>
        </div>
        <NerdLead
          class="mt-3"
          :text="headline"
          :confidence="verdict?.verdict === 'even' ? undefined : verdict?.confidence"
          :detail="headlineDetail"
          :few="isFew(overview.games)"
          :tone="verdict?.verdict === 'above' ? 'win' : verdict?.verdict === 'below' ? 'loss' : 'neutral'"
          icon="i-tabler-target-arrow"
        />
      </div>

      <!-- The tiles. -->
      <div v-if="overview" class="grid min-w-0 grid-cols-2 content-start gap-2">
        <div class="nerd-tile">
          <p class="stat-label">{{ t('nerd.hero.duration') }}</p>
          <p class="nerd-tile-value">{{ f.minutes(overview.duration) }}</p>
          <p class="text-[11px] tabular-nums text-dimmed">{{ t('nerd.hero.durationSplit', { win: f.minutes(overview.durationWin), loss: f.minutes(overview.durationLoss) }) }}</p>
        </div>
        <div class="nerd-tile">
          <p class="stat-label">{{ t('nerd.hero.kda') }}</p>
          <p class="nerd-tile-value">{{ f.number(overview.kda, 2) }}</p>
          <p class="text-[11px] text-dimmed">{{ t('nerd.hero.kdaHint') }}</p>
        </div>
        <div class="nerd-tile">
          <p class="stat-label">{{ t('nerd.hero.lp') }}</p>
          <p class="nerd-tile-value">{{ lp?.measured ? `${f.signed(lp.net)} LP` : '—' }}</p>
          <p class="text-[11px] tabular-nums text-dimmed">
            {{ lp?.measured ? t('nerd.hero.lpSplit', { count: lp.measured, win: lp.perWin === null ? '—' : f.signed(lp.perWin, 1), loss: lp.perLoss === null ? '—' : f.signed(lp.perLoss, 1) }) : t('nerd.hero.lpNone') }}
          </p>
        </div>
        <div class="nerd-tile">
          <p class="stat-label">{{ t('nerd.hero.streak') }}</p>
          <p class="nerd-tile-value">
            {{ streak ? (streak.current > 0 ? t('nerd.hero.streakWins', { count: streak.current }) : t('nerd.hero.streakLosses', { count: -streak.current })) : '—' }}
          </p>
          <p class="text-[11px] tabular-nums text-dimmed">{{ streak ? t('nerd.hero.streakLongest', { wins: streak.longestWin, losses: streak.longestLoss }) : '' }}</p>
        </div>
      </div>

      <!-- What comes with winning and with losing. -->
      <div v-if="overview" class="grid min-w-0 content-start gap-2 lg:col-span-2 lg:grid-cols-2 2xl:col-span-1 2xl:grid-cols-1">
        <div v-for="side in (['best', 'worst'] as const)" :key="side" class="nerd-tile flex gap-3">
          <span
            class="grid size-9 shrink-0 place-items-center rounded-lg"
            :class="side === 'best' ? 'bg-(--nerd-win)/15 text-(--nerd-win)' : 'bg-(--nerd-loss)/15 text-(--nerd-loss)'"
          >
            <UIcon :name="side === 'best' ? 'i-tabler-trending-up' : 'i-tabler-trending-down'" class="size-5" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="stat-label">{{ t(`nerd.hero.${side}`) }}</p>
            <template v-if="factors[side]">
              <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-highlighted">
                {{ t(`nerd.metric.${factors[side]!.definition.key}`) }}
                <NerdConfidence :level="factorConfidence(factors[side]!)" :detail="say.metricDetail(factors[side]!)" />
              </p>
              <p class="mt-0.5 text-xs leading-relaxed text-muted"><NerdRich :text="factorLine(factors[side]!)" /></p>
            </template>
            <p v-else class="text-xs text-dimmed">{{ t('nerd.hero.noFactor') }}</p>
          </div>
        </div>
      </div>
    </div>

    <NerdRibbon v-if="rows.length && overview" :rows="rows" :rate="overview.rate" />

    <!-- The history still being read back, and where its games came from. -->
    <div class="border-t border-default px-5 py-2.5 text-xs text-muted">
      <div v-if="reading || paused || total < ceiling" class="flex items-center gap-3">
        <UIcon :name="reading ? 'i-lucide-loader-circle' : 'i-tabler-database'" class="size-4 shrink-0" :class="reading ? 'animate-spin text-primary' : ''" />
        <span class="shrink-0">{{ reading ? (phase === 'blitz' ? t('nerd.hero.readingBlitz', { count: total, left: queued }) : t('nerd.hero.reading', { count: total, ceiling })) : t('nerd.hero.read', { count: total }) }}</span>
        <div class="h-1 min-w-24 flex-1 overflow-hidden rounded-full bg-accented">
          <div class="nerd-progress h-full rounded-full bg-primary" :style="{ width: `${Math.min(total / ceiling, 1) * 100}%` }" />
        </div>
        <UButton v-if="reading || paused" size="xs" color="neutral" variant="ghost" :icon="paused ? 'i-lucide-play' : 'i-lucide-pause'" :label="paused ? t('nerd.hero.resume') : t('nerd.hero.pause')" @click="$emit('toggleReading')" />
      </div>
      <p v-if="sourceParts.length" class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-dimmed">
        <span>{{ t('nerd.source.title') }}:</span>
        <span v-for="part in sourceParts" :key="part.source" class="flex items-center gap-1">
          <UIcon :name="SOURCE_ICONS[part.source]" class="size-3.5" />{{ t(`nerd.source.${part.source}`, { count: part.count }) }}
        </span>
        <UTooltip :text="t('nerd.source.hint')">
          <UIcon name="i-lucide-info" class="size-3.5 cursor-help" tabindex="0" :aria-label="t('nerd.source.hint')" />
        </UTooltip>
        <span v-if="blitzMissing" class="flex items-center gap-1 text-warning"><UIcon name="i-lucide-cloud-off" class="size-3.5" />{{ t('nerd.hero.blitzMissing') }}</span>
      </p>
    </div>
  </section>
</template>

<style scoped>
.nerd-hero-glow {
  position: absolute;
  inset: -40% -10% auto -10%;
  height: 160%;
  z-index: -1;
  background:
    radial-gradient(40% 50% at 12% 20%, color-mix(in oklch, var(--nerd-win) 22%, transparent), transparent 70%),
    radial-gradient(35% 45% at 88% 10%, color-mix(in oklch, var(--ui-primary) 12%, transparent), transparent 70%);
  filter: blur(8px);
  animation: nerd-drift 18s ease-in-out infinite alternate;
}

.nerd-hero-watermark {
  position: absolute;
  right: 1.5rem;
  bottom: 12.5rem;
  z-index: -1;
  font-size: 2.75rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  white-space: nowrap;
  color: color-mix(in oklch, var(--ui-text-highlighted) 4%, transparent);
  user-select: none;
}

.nerd-tile {
  border-radius: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: color-mix(in oklch, var(--ui-bg-elevated) 55%, transparent);
  box-shadow: inset 0 0 0 1px var(--ui-border);
  backdrop-filter: blur(6px);
}

.nerd-tile-value {
  font-family: var(--font-display);
  font-size: 1.375rem;
  font-weight: 600;
  line-height: 1.6rem;
  color: var(--ui-text-highlighted);
}

.nerd-grow {
  transform-origin: left;
  animation: nerd-grow 700ms var(--tm-ease) backwards 120ms;
}

.nerd-progress {
  transition: width 400ms var(--tm-ease);
}

@keyframes nerd-drift {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(4%, 6%, 0); }
}

@keyframes nerd-grow {
  from { transform: scaleX(0); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .nerd-hero-glow, .nerd-grow {
    animation: none;
  }
}
</style>
