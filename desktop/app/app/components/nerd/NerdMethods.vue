<script setup lang="ts">
import type { NerdReport } from '~/utils/nerd-stats/analysis'
import { MODEL_COVERAGE } from '~/utils/nerd-stats/analysis'
import { FEW_GAMES } from '~/utils/nerd-stats/insights'

/**
 * Every method on the page, named, written out and explained in plain words —
 * with the figures this sample gave it — and, first, what none of them can
 * say: that a metric which comes with winning makes the player win. Each card
 * leads with the plain name the rest of the page uses, the statistics' own
 * name under it; the first explains the four confidence words.
 */
const props = defineProps<{ report: NerdReport }>()

const { t } = useT()
const f = useNerdFormat()

const tested = computed(() => props.report.metrics.filter(entry => entry.correlation).length)
const discoveries = computed(() => props.report.metrics.filter(entry => entry.q < 0.05).length)

/**
 * The formulas' words and decimals in the player's language — W/L or V/D, CI
 * or IC, 1.96 or 1,96 — as `$name` in the lines below; `^{…}` and `_{…}` are
 * raised and lowered by `NerdMath`.
 */
const symbols = computed<Record<string, string>>(() => ({
  W: t('nerd.symbol.win'),
  L: t('nerd.symbol.loss'),
  CI: t('nerd.symbol.ci'),
  SE: t('nerd.symbol.se'),
  z: f.number(1.96, 2),
  silverman: f.number(1.06, 2),
  p01: f.number(0.01, 2),
  p05: f.number(0.05, 2),
  p20: f.number(0.2, 2),
  few: String(FEW_GAMES),
  strong: t('nerd.confidence.strong'),
  moderate: t('nerd.confidence.moderate'),
  weak: t('nerd.confidence.weak'),
  uncertain: t('nerd.confidence.uncertain'),
}))
const written = (line: string) => line.replace(/\$(\w+)/g, (_, name: string) => symbols.value[name] ?? name)

const METHODS = computed(() => [
  {
    key: 'confidence',
    icon: 'i-tabler-antenna-bars-5',
    formula: ['p < $p01  →  $strong', '$p01 ≤ p < $p05  →  $moderate', '$p05 ≤ p < $p20  →  $weak', 'p ≥ $p20  →  $uncertain'],
    figure: t('nerd.methods.figure.confidence', { few: FEW_GAMES }),
  },
  {
    key: 'wilson',
    icon: 'i-tabler-target-arrow',
    formula: ['p̂ = $W / n', '$CI = [p̂ + z²/2n ± z·√(p̂(1 − p̂)/n + z²/4n²)] / (1 + z²/n)', 'z = $z'],
    figure: t('nerd.methods.figure.wilson', { rate: f.percent(props.report.overview.rate, 1), low: f.percent(props.report.overview.low, 1), high: f.percent(props.report.overview.high, 1), count: props.report.overview.games }),
  },
  {
    key: 'pointBiserial',
    icon: 'i-tabler-chart-line',
    formula: ['r_{pb} = (M_{$W} − M_{$L}) / s · √(n_{$W}·n_{$L} / n²)', 't = r·√((n − 2) / (1 − r²)),  ν = n − 2', '$CI = tanh(atanh(r) ± $z / √(n − 3))'],
    figure: t('nerd.methods.figure.tests', { count: tested.value }),
  },
  {
    key: 'cohen',
    icon: 'i-tabler-arrows-diff',
    formula: ['d = (x̄_{$W} − x̄_{$L}) / s_{p}', 's_{p} = √[((n_{$W} − 1)s_{$W}² + (n_{$L} − 1)s_{$L}²) / (n_{$W} + n_{$L} − 2)]', '$SE(d) = √[(n_{$W} + n_{$L}) / (n_{$W}·n_{$L}) + d² / 2(n_{$W} + n_{$L})]'],
    figure: t('nerd.methods.figure.cohen'),
  },
  {
    key: 'fdr',
    icon: 'i-tabler-filter-check',
    formula: ['p_{(1)} ≤ … ≤ p_{(m)}', 'q_{(i)} = min_{j ≥ i} m·p_{(j)} / j'],
    figure: t('nerd.methods.figure.fdr', { count: discoveries.value, total: tested.value }),
  },
  {
    key: 'logistic',
    icon: 'i-tabler-math-function',
    formula: ['P($W) = σ(β₀ + Σ βᵢ·zᵢ),  σ(t) = 1 / (1 + e^{−t})', 'max  ℓ(β) − (λ/2)·Σ βᵢ²', 'β ← β + (XᵀWX + Λ)^{−1} (Xᵀ(y − p) − Λβ)'],
    figure: props.report.model
      ? t('nerd.methods.figure.logistic', { count: props.report.model.features.length, lambda: f.number(props.report.model.lambda, 0), coverage: f.percent(MODEL_COVERAGE, 0) })
      : t('nerd.methods.figure.noModel'),
  },
  {
    key: 'odds',
    icon: 'i-tabler-multiplier-2x',
    formula: ['OR = e^{β}', '$CI = e^{β ± $z·$SE},  $SE² = diag (XᵀWX + Λ)^{−1}', 'Δlogit = Σ βᵢ·(z̄_{i,$W} − z̄_{i,$L})'],
    figure: t('nerd.methods.figure.odds'),
  },
  {
    key: 'cv',
    icon: 'i-tabler-repeat',
    formula: ['AUC = P(p̂_{$W} > p̂_{$L}) = U / (n_{$W}·n_{$L})', 'Brier = (1/n)·Σ (p̂ᵢ − yᵢ)²'],
    figure: props.report.model
      ? t('nerd.methods.figure.cv', { folds: props.report.model.validation.folds, auc: f.number(props.report.model.validation.auc, 2), accuracy: f.percent(props.report.model.validation.accuracy, 1), baseline: f.percent(props.report.model.validation.baseline, 1) })
      : t('nerd.methods.figure.noModel'),
  },
  {
    key: 'shrinkage',
    icon: 'i-tabler-arrows-minimize',
    formula: ['p̃ = ($W + α) / (n + α + β)', 'ρ̂ = (Q / μ(1 − μ) − (G − 1)) / (N − Σnᵢ² / N)', 'κ = α + β = 1/ρ̂ − 1'],
    figure: t('nerd.methods.figure.shrinkage', { strength: f.number(props.report.champions.prior.strength, 0), mean: f.percent(props.report.champions.prior.mean, 1) }),
  },
  {
    key: 'kernel',
    icon: 'i-tabler-wave-sine',
    formula: ['p̂(x) = Σ wᵢ·yᵢ / Σ wᵢ,  wᵢ = exp(−(x − xᵢ)² / 2h²)', 'h = $silverman·σ·n^{−1/5},  n_{eff} = (Σw)² / Σw²'],
    figure: t('nerd.methods.figure.kernel', { bandwidth: f.number(props.report.duration.bandwidth, 1) }),
  },
  {
    key: 'runs',
    icon: 'i-tabler-arrows-shuffle',
    formula: ['E[R] = 2·n_{$W}·n_{$L} / n + 1', 'Var[R] = 2n_{$W}n_{$L}(2n_{$W}n_{$L} − n) / n²(n − 1)', 'z = (R − E[R]) / √Var[R]'],
    figure: props.report.sequence.runs
      ? t('nerd.methods.figure.runs', { runs: props.report.sequence.runs.runs, expected: f.number(props.report.sequence.runs.expected, 1), z: f.signed(props.report.sequence.runs.z, 2) })
      : t('nerd.methods.figure.noRuns'),
  },
  {
    key: 'spearman',
    icon: 'i-tabler-grid-dots',
    formula: ['ρ = r(R(x), R(y))'],
    figure: t('nerd.methods.figure.spearman', { count: props.report.correlation.keys.length }),
  },
  {
    key: 'bins',
    icon: 'i-tabler-chart-bar',
    formula: ['Q(1/k), …, Q((k − 1)/k)', 'k = 4 (n ≥ 40),  k = 3 (n < 40)'],
    figure: t('nerd.methods.figure.bins'),
  },
])
</script>

<template>
  <div class="space-y-4">
    <section class="surface relative overflow-hidden rounded-lg p-4">
      <div class="flex gap-3">
        <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning">
          <UIcon name="i-lucide-triangle-alert" class="size-5" />
        </span>
        <div class="min-w-0 space-y-1.5 text-sm">
          <h2 class="text-base font-semibold text-highlighted">{{ t('nerd.methods.caveatTitle') }}</h2>
          <p class="text-muted">{{ t('nerd.methods.caveatCausation') }}</p>
          <p class="text-muted">{{ t('nerd.methods.caveatSample', { count: report.overview.games }) }}</p>
          <p class="text-muted">{{ t('nerd.methods.caveatMissing') }}</p>
        </div>
      </div>
    </section>

    <div class="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      <article v-for="method in METHODS" :key="method.key" class="surface flex flex-col rounded-lg p-4">
        <header class="flex items-center gap-2.5">
          <span class="tm-emblem grid size-8 shrink-0 place-items-center rounded-lg text-primary">
            <UIcon :name="method.icon" class="size-4" />
          </span>
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-highlighted">{{ t(`nerd.methods.${method.key}.title`) }}</h3>
            <p class="text-[11px] text-dimmed">{{ t(`nerd.methods.${method.key}.technical`) }}</p>
          </div>
        </header>
        <div class="mt-3 space-y-1.5 rounded-md bg-(--tm-pane-2) px-3 py-2.5 text-[13px] leading-relaxed text-highlighted ring-1 ring-default">
          <p v-for="line in method.formula" :key="line"><NerdMath :text="written(line)" /></p>
        </div>
        <p class="mt-3 flex-1 text-xs leading-relaxed text-muted">{{ t(`nerd.methods.${method.key}.body`) }}</p>
        <p class="mt-2 flex items-start gap-1.5 text-[11px] text-dimmed">
          <UIcon name="i-tabler-database" class="mt-px size-3.5 shrink-0" />{{ method.figure }}
        </p>
      </article>
    </div>
  </div>
</template>
