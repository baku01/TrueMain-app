<script setup lang="ts">
import type { ModelReport } from '~/utils/nerd-stats/analysis'
import { MIN_MODEL_EVENTS, MIN_MODEL_GAMES } from '~/utils/nerd-stats/analysis'
import { formulaWeights, modelGrade } from '~/utils/nerd-stats/formula-insights'

/**
 * The formula of victory for a player, not a statistician: what weighs most
 * on their wins, ranked, each metric a bar of how much a typical step more of
 * it — in the game's own units, from their average game — moves their chance
 * of winning, and the sentence that says it; how well the formula calls games
 * it never saw, in a word; and a calculator in the same units. The equation,
 * the odds ratios and the validation's scores are behind "show the maths"
 * (`NerdFormulaMath`), each symbol explained in a line.
 */
const props = defineProps<{
  model: ModelReport | null
  games: number
  /** The player's average game length, in minutes. */
  minutes: number
}>()

const { t } = useT()
const f = useNerdFormat()
const say = useNerdSay()

const weights = computed(() => (props.model ? formulaWeights(props.model, props.minutes) : []))
const scale = computed(() => Math.max(0.05, ...weights.value.map(weight => Math.abs(weight.change))))
const grade = computed(() => (props.model ? modelGrade(props.model) : null))

const top = computed(() => weights.value[0] ?? null)
const topLine = computed(() => (top.value ? t('nerd.formula.sayTop', { metric: t(`nerd.natural.${top.value.key}`), step: say.step(top.value) }) : ''))
const quality = computed(() => {
  const model = props.model
  if (!model || !grade.value) return ''
  return t('nerd.formula.sayQuality', {
    accuracy: f.percent(model.validation.accuracy),
    baseline: f.percent(model.validation.baseline),
    guess: (grade.value.guessWin ? t('nerd.win') : t('nerd.loss')).toLocaleLowerCase(),
    grade: t(`nerd.formula.grade.${grade.value.grade}`),
  })
})

const symbols = computed(() => [
  { symbol: `P(${t('nerd.symbol.win')})`, meaning: t('nerd.formula.sym.p') },
  { symbol: 'σ(t) = 1 / (1 + e^{−t})', meaning: t('nerd.formula.sym.sigma') },
  { symbol: 'β₀', value: props.model ? f.number(props.model.intercept, 2) : undefined, meaning: t('nerd.formula.sym.intercept') },
  { symbol: 'βᵢ', meaning: t('nerd.formula.sym.beta') },
  { symbol: 'zᵢ = (xᵢ − μᵢ) / σᵢ', meaning: t('nerd.formula.sym.z') },
  { symbol: 'e^{β}', meaning: t('nerd.formula.sym.odds') },
  { symbol: 'λ', value: props.model ? f.number(props.model.lambda, 0) : undefined, meaning: t('nerd.formula.sym.lambda') },
  { symbol: 'AUC', value: props.model ? f.number(props.model.validation.auc, 2) : undefined, meaning: t('nerd.formula.sym.auc') },
])
</script>

<template>
  <section class="surface relative overflow-hidden rounded-lg">
    <NerdCardHeader
      icon="i-tabler-math-function"
      :title="t('nerd.formula.title')"
      :technical="t('nerd.formula.technical')"
      :subtitle="model ? t('nerd.formula.subtitle', { count: model.games }) : t('nerd.formula.none', { min: MIN_MODEL_GAMES, events: MIN_MODEL_EVENTS })"
    />

    <div v-if="model" class="space-y-4 p-4">
      <div class="grid gap-2 xl:grid-cols-2">
        <NerdLead
          v-if="top"
          :text="topLine"
          :confidence="top.confidence"
          :detail="`β = ${f.signed(model.features.find(feature => feature.key === top!.key)!.beta, 2)}`"
          :tone="top.change >= 0 ? 'win' : 'loss'"
          icon="i-tabler-crown"
        />
        <NerdLead
          :text="quality"
          :confidence="grade?.confidence"
          :detail="`AUC = ${f.number(model.validation.auc, 2)} [${f.number(model.aucLow, 2)}; ${f.number(model.aucHigh, 2)}]`"
          :few="model.games < 60 || model.eventsPerVariable < 10"
          icon="i-tabler-target-arrow"
        />
      </div>

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <!-- What weighs most: each metric's step, ranked. -->
        <div class="min-w-0">
          <h3 class="stat-label mb-2">{{ t('nerd.formula.weightsTitle') }}</h3>
          <ul class="space-y-2">
            <li v-for="(weight, index) in weights" :key="weight.key" class="nerd-weight">
              <div class="flex items-center gap-2">
                <span class="w-5 shrink-0 text-right text-[11px] font-semibold tabular-nums text-dimmed">{{ index + 1 }}</span>
                <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-highlighted">{{ t(`nerd.natural.${weight.key}`) }}</span>
                <NerdConfidence :level="weight.confidence" />
              </div>
              <div class="mt-1 grid grid-cols-[1.25rem_minmax(0,1fr)_3.5rem] items-center gap-2">
                <span />
                <div class="relative h-3.5 rounded-full bg-accented/50">
                  <span class="absolute inset-y-[-2px] left-1/2 w-px bg-(--ui-border-accented)" />
                  <span
                    class="nerd-bar absolute inset-y-0"
                    :class="weight.change >= 0 ? 'rounded-r-full' : 'rounded-l-full'"
                    :style="{
                      left: weight.change >= 0 ? '50%' : `${50 - Math.abs(weight.change) / scale * 50}%`,
                      width: `${Math.abs(weight.change) / scale * 50}%`,
                      background: weight.change >= 0 ? 'var(--nerd-win)' : 'var(--nerd-loss)',
                      transformOrigin: weight.change >= 0 ? 'left' : 'right',
                      animationDelay: `${index * 60}ms`,
                    }"
                  />
                </div>
                <span class="text-right text-xs font-semibold tabular-nums" :class="weight.change >= 0 ? 'text-(--nerd-win)' : 'text-(--nerd-loss)'">{{ t('nerd.points', { diff: f.points(weight.change) }) }}</span>
              </div>
              <p class="mt-1 pl-7 text-[11.5px] leading-relaxed text-muted"><NerdRich :text="say.step(weight)" /></p>
            </li>
          </ul>
          <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-dimmed">
            <span class="flex items-center gap-1.5"><span class="h-2 w-3 rounded-r-full bg-(--nerd-win)" />{{ t('nerd.formula.helps') }}</span>
            <span class="flex items-center gap-1.5"><span class="h-2 w-3 rounded-l-full bg-(--nerd-loss)" />{{ t('nerd.formula.hurts') }}</span>
          </div>
          <div class="mt-2">
            <NerdHowTo :text="t('nerd.formula.weightsHow')" />
          </div>
        </div>

        <NerdCalculator :model="model" :minutes="minutes" />
      </div>

      <NerdDetails :symbols="symbols">
        <NerdFormulaMath :model="model" />
      </NerdDetails>
    </div>

    <div v-else class="p-6 text-sm text-muted">{{ t('nerd.formula.noneHint', { count: games }) }}</div>
  </section>
</template>

<style scoped>
.nerd-weight {
  padding: 0.5rem 0.625rem 0.5rem 0.25rem;
  border-radius: 0.5rem;
  transition: background 150ms;
}

.nerd-weight:hover {
  background: color-mix(in oklch, var(--ui-bg-elevated) 50%, transparent);
}

.nerd-bar {
  animation: nerd-bar 600ms var(--tm-ease) backwards;
}

@keyframes nerd-bar {
  from { transform: scaleX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .nerd-bar {
    animation: none;
  }
}
</style>
