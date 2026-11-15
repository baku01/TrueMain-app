<script setup lang="ts">
import type { ModelReport } from '~/utils/nerd-stats/analysis'
import { MIN_MODEL_EVENTS, MIN_MODEL_GAMES } from '~/utils/nerd-stats/analysis'
import { DEFINITION_BY_KEY } from '~/utils/nerd-stats/features'
import { sigmoid } from '~/utils/nerd-stats/logistic'

/**
 * The formula of victory (`victoryModel`): the fitted equation written out with
 * its real coefficients; each metric's odds ratio per standard deviation with
 * its 95% interval, on a log scale around 1; how much of the gap between the
 * average win and the average loss each metric accounts for; how well the
 * formula predicts games it was not fitted to (cross-validated AUC, accuracy
 * against always guessing the commoner result, Brier score, the ROC curve);
 * and a calculator — the player sets each metric and reads P(win).
 */
const props = defineProps<{
  model: ModelReport | null
  games: number
}>()

const { t } = useT()
const f = useNerdFormat()
const forestTip = useChartTip()

const label = (key: string) => t(`nerd.metric.${key}`)
const isBinary = (key: string) => DEFINITION_BY_KEY.get(key as never)?.format === 'binary'

/** The forest's log-scale domain, wide enough for every interval and never narrower than ×0.5–×2. */
const domain = computed(() => {
  const features = props.model?.features ?? []
  const low = Math.min(0.5, ...features.map(feature => feature.low))
  const high = Math.max(2, ...features.map(feature => feature.high))
  return [Math.log(Math.max(low, 0.1)), Math.log(Math.min(high, 10))] as const
})
const along = (ratio: number) => {
  const [low, high] = domain.value
  return Math.min(Math.max((Math.log(ratio) - low) / (high - low), 0), 1) * 100
}
const TICKS = [0.25, 0.5, 1, 2, 4]
const ticks = computed(() => TICKS.filter(tick => Math.log(tick) >= domain.value[0] - 1e-9 && Math.log(tick) <= domain.value[1] + 1e-9))

/** Whether a metric's interval clears 1, and which way: what its marks are coloured by. */
const toneOf = (low: number, high: number) => (low > 1 ? 'var(--nerd-win)' : high < 1 ? 'var(--nerd-loss)' : 'var(--ui-text-dimmed)')

const gapTotal = computed(() => props.model?.features.reduce((total, feature) => total + feature.gap, 0) ?? 0)
const gapScale = computed(() => Math.max(0.1, ...(props.model?.features ?? []).map(feature => Math.abs(feature.gap))))

// The calculator: every metric starts at the player's mean, the "typical game".
const inputs = ref<Record<string, number>>({})
watch(() => props.model, (model) => {
  inputs.value = Object.fromEntries((model?.features ?? []).map(feature => [feature.key, isBinary(feature.key) ? Math.round(feature.mean) : feature.mean]))
}, { immediate: true })
const logit = computed(() => {
  const model = props.model
  if (!model) return 0
  return model.features.reduce((total, feature) => total + feature.beta * ((inputs.value[feature.key] ?? feature.mean) - feature.mean) / feature.sd, model.intercept)
})
const probability = computed(() => sigmoid(logit.value))
const step = (low: number, high: number) => Math.max((high - low) / 100, 1e-4)
function reset() {
  inputs.value = Object.fromEntries((props.model?.features ?? []).map(feature => [feature.key, isBinary(feature.key) ? Math.round(feature.mean) : feature.mean]))
}

const rocPath = computed(() => (props.model?.validation.roc ?? []).map(point => `${point.fpr * 100},${100 - point.tpr * 100}`).join(' '))
</script>

<template>
  <section class="surface relative overflow-hidden rounded-lg">
    <header class="flex flex-wrap items-start gap-3 border-b border-default px-4 py-3.5">
      <span class="tm-emblem grid size-9 shrink-0 place-items-center rounded-lg text-primary">
        <UIcon name="i-tabler-math-function" class="size-5" />
      </span>
      <div class="min-w-0 flex-1">
        <h2 class="text-base font-semibold text-highlighted">{{ t('nerd.formula.title') }}</h2>
        <p class="text-xs text-muted">{{ model ? t('nerd.formula.subtitle', { count: model.games, lambda: f.number(model.lambda, 0), folds: model.validation.folds }) : t('nerd.formula.none', { min: MIN_MODEL_GAMES, events: MIN_MODEL_EVENTS }) }}</p>
      </div>
    </header>

    <div v-if="model" class="space-y-5 p-4">
      <!-- The equation, with the fitted numbers. -->
      <div class="nerd-equation rounded-lg px-4 py-3.5">
        <p class="text-sm text-muted"><NerdMath :text="`logit P(${t('nerd.symbol.win')}) = ln(P / (1 − P)) = β₀ + Σ βᵢ·zᵢ,   zᵢ = (xᵢ − μᵢ) / σᵢ`" /></p>
        <div class="nerd-math mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-[15px] text-highlighted">
          <span class="font-semibold">P({{ t('nerd.symbol.win') }}) = σ(</span>
          <span class="nerd-term" :style="{ '--term': 'var(--ui-text-dimmed)' }">{{ f.number(model.intercept, 2) }}</span>
          <span
            v-for="feature in model.features"
            :key="feature.key"
            class="nerd-term"
            :style="{ '--term': feature.beta >= 0 ? 'var(--nerd-win)' : 'var(--nerd-loss)' }"
          >
            {{ feature.beta >= 0 ? '+' : '−' }} {{ f.number(Math.abs(feature.beta), 2) }} · z<sub class="font-sans text-[10px] text-muted">{{ label(feature.key) }}</sub>
          </span>
          <span class="font-semibold">)</span>
        </div>
        <p class="mt-2 text-xs leading-relaxed text-muted">{{ t('nerd.formula.read') }}</p>
      </div>

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <!-- Odds ratios per standard deviation. -->
        <div :ref="el => (forestTip.box.value = el as HTMLElement)" class="relative min-w-0">
          <h3 class="stat-label mb-2">{{ t('nerd.formula.oddsTitle') }}</h3>
          <table class="w-full text-xs">
            <thead class="text-dimmed">
              <tr class="text-left">
                <th class="pb-1.5 font-medium">{{ t('nerd.col.metric') }}</th>
                <th class="pb-1.5 text-right font-medium">μ · σ</th>
                <th class="pb-1.5 text-right font-medium">β</th>
                <th class="pb-1.5 text-right font-medium">e<sup>β</sup> [IC 95%]</th>
                <th class="w-[38%] pb-1.5 pl-3 font-medium">
                  <div class="relative h-3">
                    <span v-for="tick in ticks" :key="tick" class="absolute -translate-x-1/2 tabular-nums" :style="{ left: `${along(tick)}%` }">×{{ f.number(tick, tick < 1 ? 2 : 0) }}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(feature, index) in model.features" :key="feature.key" class="border-t border-default/60">
                <td class="py-1.5 pr-2 font-medium text-highlighted">{{ label(feature.key) }}</td>
                <td class="py-1.5 text-right tabular-nums text-muted">{{ f.metric(DEFINITION_BY_KEY.get(feature.key)!, feature.mean) }} · {{ f.metric(DEFINITION_BY_KEY.get(feature.key)!, feature.sd).replace('+', '') }}</td>
                <td class="py-1.5 text-right tabular-nums">{{ f.signed(feature.beta, 2) }}</td>
                <td class="py-1.5 text-right tabular-nums">
                  <span class="font-semibold text-highlighted">{{ f.number(feature.oddsRatio, 2) }}</span>
                  <span class="text-dimmed"> [{{ f.number(feature.low, 2) }}; {{ f.number(feature.high, 2) }}]</span>
                </td>
                <td class="py-1.5 pl-3">
                  <div
                    class="relative h-5 cursor-default"
                    tabindex="0"
                    role="img"
                    :aria-label="`${label(feature.key)}: ×${f.number(feature.oddsRatio, 2)}`"
                    @pointerenter="forestTip.show($event, label(feature.key), [
                      { label: t('nerd.formula.orLabel'), value: `×${f.number(feature.oddsRatio, 2)}`, swatch: toneOf(feature.low, feature.high) },
                      { label: t('nerd.formula.ciLabel'), value: `${f.number(feature.low, 2)} – ${f.number(feature.high, 2)}` },
                      { label: t('nerd.formula.seLabel'), value: f.number(feature.se, 3) },
                    ])"
                    @focus="forestTip.show($event, label(feature.key), [{ label: t('nerd.formula.orLabel'), value: `×${f.number(feature.oddsRatio, 2)}` }])"
                    @pointerleave="forestTip.hide"
                    @blur="forestTip.hide"
                  >
                    <span v-for="tick in ticks" :key="tick" class="absolute inset-y-0 w-px" :class="tick === 1 ? 'bg-(--ui-border-accented)' : 'bg-(--ui-border)/60'" :style="{ left: `${along(tick)}%` }" />
                    <span
                      class="nerd-whisker absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
                      :style="{ left: `${along(feature.low)}%`, width: `${along(feature.high) - along(feature.low)}%`, background: toneOf(feature.low, feature.high), animationDelay: `${index * 60}ms` }"
                    />
                    <span
                      class="absolute top-1/2 size-2.5 -translate-1/2 rounded-full ring-2 ring-(--tm-pane)"
                      :style="{ left: `${along(feature.oddsRatio)}%`, background: toneOf(feature.low, feature.high) }"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <p class="mt-2 text-[11px] leading-relaxed text-dimmed">{{ t('nerd.formula.oddsHint') }}</p>
          <NerdTip :tip="forestTip.tip.value" />
        </div>

        <!-- Each metric's share of the gap between the average win and the average loss. -->
        <div class="min-w-0">
          <h3 class="stat-label mb-2">{{ t('nerd.formula.gapTitle') }}</h3>
          <ul class="space-y-1.5">
            <li v-for="(feature, index) in [...model.features].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))" :key="feature.key" class="grid grid-cols-[8.5rem_minmax(0,1fr)_3.25rem] items-center gap-2 text-xs">
              <span class="truncate text-muted">{{ label(feature.key) }}</span>
              <div class="relative h-4">
                <span class="absolute inset-y-0 left-1/2 w-px bg-(--ui-border-accented)" />
                <span
                  class="nerd-bar absolute top-0.5 bottom-0.5"
                  :class="feature.gap >= 0 ? 'rounded-r-[4px]' : 'rounded-l-[4px]'"
                  :style="{
                    left: feature.gap >= 0 ? '50%' : `${50 - Math.abs(feature.gap) / gapScale * 50}%`,
                    width: `${Math.abs(feature.gap) / gapScale * 50}%`,
                    background: feature.gap >= 0 ? 'var(--nerd-win)' : 'var(--nerd-loss)',
                    transformOrigin: feature.gap >= 0 ? 'left' : 'right',
                    animationDelay: `${index * 60}ms`,
                  }"
                />
              </div>
              <span class="text-right tabular-nums text-highlighted">{{ f.signed(feature.gap, 2) }}</span>
            </li>
          </ul>
          <p class="mt-3 text-[11px] leading-relaxed text-dimmed">
            {{ t('nerd.formula.gapHint', { total: f.signed(gapTotal, 2), times: f.number(Math.exp(gapTotal), 1) }) }}
          </p>
        </div>
      </div>

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <!-- How well it predicts games it never saw. -->
        <div class="min-w-0">
          <h3 class="stat-label mb-2">{{ t('nerd.formula.validationTitle', { folds: model.validation.folds }) }}</h3>
          <div class="flex gap-4">
            <div class="grid flex-1 grid-cols-2 content-start gap-2">
              <div class="nerd-mini">
                <p class="stat-label">{{ t('nerd.formula.auc') }}</p>
                <p class="nerd-mini-value">{{ f.number(model.validation.auc, 2) }}</p>
                <p class="text-[10px] tabular-nums text-dimmed">[{{ f.number(model.aucLow, 2) }}; {{ f.number(model.aucHigh, 2) }}] · {{ t('nerd.formula.aucCoin') }}</p>
              </div>
              <div class="nerd-mini">
                <p class="stat-label">{{ t('nerd.formula.accuracy') }}</p>
                <p class="nerd-mini-value">{{ f.percent(model.validation.accuracy, 1) }}</p>
                <p class="text-[10px] tabular-nums text-dimmed">{{ t('nerd.formula.baseline', { rate: f.percent(model.validation.baseline, 1) }) }}</p>
              </div>
              <div class="nerd-mini">
                <p class="stat-label">{{ t('nerd.formula.brier') }}</p>
                <p class="nerd-mini-value">{{ f.number(model.validation.brier, 3) }}</p>
                <p class="text-[10px] tabular-nums text-dimmed">{{ t('nerd.formula.brierHint') }}</p>
              </div>
              <div class="nerd-mini">
                <p class="stat-label">{{ t('nerd.formula.epv') }}</p>
                <p class="nerd-mini-value">{{ f.number(model.eventsPerVariable, 1) }}</p>
                <p class="text-[10px] tabular-nums text-dimmed">{{ t('nerd.formula.epvHint') }}</p>
              </div>
            </div>
            <figure class="w-36 shrink-0">
              <div class="relative aspect-square rounded-md bg-(--tm-pane-2) ring-1 ring-default">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 size-full" role="img" :aria-label="t('nerd.formula.rocLabel', { auc: f.number(model.validation.auc, 2) })">
                  <line x1="0" y1="100" x2="100" y2="0" class="stroke-[var(--ui-border-accented)]" vector-effect="non-scaling-stroke" />
                  <polygon :points="`0,100 ${rocPath} 100,100`" class="fill-(--nerd-win)/10" />
                  <polyline :points="rocPath" fill="none" class="stroke-(--nerd-win)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                </svg>
              </div>
              <figcaption class="mt-1 text-center text-[10px] text-dimmed">{{ t('nerd.formula.roc') }}</figcaption>
            </figure>
          </div>
          <p v-if="model.eventsPerVariable < 10 || model.games < 60" class="mt-3 flex gap-1.5 text-[11px] text-warning">
            <UIcon name="i-lucide-triangle-alert" class="mt-px size-3.5 shrink-0" />{{ t('nerd.formula.small') }}
          </p>
          <p v-if="model.held.length" class="mt-2 text-[11px] text-dimmed">
            {{ t('nerd.formula.held', { metrics: model.held.map(label).join(', ') }) }}
          </p>
        </div>

        <!-- The calculator. -->
        <div class="nerd-equation min-w-0 rounded-lg p-3.5">
          <div class="flex items-center gap-3">
            <h3 class="stat-label flex-1">{{ t('nerd.formula.calculator') }}</h3>
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" :label="t('nerd.formula.reset')" @click="reset" />
          </div>
          <div class="mt-2 flex items-center gap-4">
            <div class="w-28 shrink-0">
              <p class="font-display text-4xl font-semibold leading-none text-highlighted">{{ f.percent(probability, 0) }}</p>
              <p class="mt-1 text-[10px] text-dimmed">{{ t('nerd.formula.probability') }}</p>
            </div>
            <div class="relative h-2.5 flex-1 overflow-hidden rounded-full bg-(--nerd-loss)/25">
              <div class="absolute inset-y-0 left-0 rounded-full bg-(--nerd-win) transition-[width] duration-300" :style="{ width: `${probability * 100}%` }" />
              <span class="absolute inset-y-0 left-1/2 w-px bg-(--tm-pane)" />
            </div>
          </div>
          <div class="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-2">
            <label v-for="feature in model.features" :key="feature.key" :for="`nerd-calc-${feature.key}`" class="block text-xs">
              <span class="flex justify-between gap-2">
                <span class="truncate text-muted">{{ label(feature.key) }}</span>
                <span class="tabular-nums text-highlighted">{{ isBinary(feature.key) ? (inputs[feature.key] ? t('nerd.yes') : t('nerd.no')) : f.metric(DEFINITION_BY_KEY.get(feature.key)!, inputs[feature.key] ?? feature.mean) }}</span>
              </span>
              <input
                v-if="isBinary(feature.key)"
                :id="`nerd-calc-${feature.key}`"
                v-model.number="inputs[feature.key]"
                type="range"
                min="0"
                max="1"
                step="1"
                class="nerd-range mt-1 w-full"
              >
              <input
                v-else
                :id="`nerd-calc-${feature.key}`"
                v-model.number="inputs[feature.key]"
                type="range"
                :min="feature.p5"
                :max="feature.p95"
                :step="step(feature.p5, feature.p95)"
                class="nerd-range mt-1 w-full"
              >
            </label>
          </div>
          <p class="mt-2 text-[11px] text-dimmed"><NerdMath :text="`logit = ${f.number(logit, 3)},   σ(logit) = 1 / (1 + e^{−logit})`" /></p>
        </div>
      </div>
    </div>

    <div v-else class="p-6 text-sm text-muted">{{ t('nerd.formula.noneHint', { count: games }) }}</div>
  </section>
</template>

<style scoped>
.nerd-equation {
  background:
    linear-gradient(135deg, color-mix(in oklch, var(--ui-primary) 7%, transparent), transparent 60%),
    var(--tm-pane-2);
  box-shadow: inset 0 0 0 1px var(--ui-border);
}

.nerd-term {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.375rem;
  background: color-mix(in oklch, var(--term) 12%, transparent);
  box-shadow: inset 2px 0 0 var(--term);
  animation: tm-rise 320ms var(--tm-ease) backwards;
}

.nerd-mini {
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  background: var(--tm-pane-2);
  box-shadow: inset 0 0 0 1px var(--ui-border);
}

.nerd-mini-value {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--ui-text-highlighted);
}

.nerd-bar {
  animation: nerd-bar 600ms var(--tm-ease) backwards;
}

.nerd-whisker {
  transform-origin: center;
  animation: nerd-bar 600ms var(--tm-ease) backwards;
}

.nerd-range {
  accent-color: var(--ui-primary);
  height: 1rem;
}

@keyframes nerd-bar {
  from { transform: scaleX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .nerd-term, .nerd-bar, .nerd-whisker {
    animation: none;
  }
}
</style>
