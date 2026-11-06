<script setup lang="ts">
/**
 * A damage split as Blitz draws it: three tinted pills — physical, magic,
 * true — each as wide as its share, the share inside when there is room for
 * it. Even thirds, faded, while the split is unknown. The teams' meter
 * (`TeamDamageMeter`) and a champion's split (`BuildDamageSplit`) share it.
 */
const props = defineProps<{ split: { physicalShare: number, magicShare: number, trueShare: number } | null }>()
const { t } = useT()

const KINDS = [
  { key: 'physical', share: 'physicalShare', color: 'var(--color-stat-ad)', label: 'AD', min: 0.15 },
  { key: 'magic', share: 'magicShare', color: 'var(--color-stat-ap)', label: 'AP', min: 0.15 },
  { key: 'true', share: 'trueShare', color: 'var(--color-stat-true)', label: 'True', min: 0.2 },
] as const

const pills = computed(() => KINDS.map(kind => ({ ...kind, value: props.split ? props.split[kind.share] : 1 / 3 })))
const percent = (value: number) => `${Math.round(value * 100)}%`
</script>

<template>
  <div class="flex h-7 gap-1" :class="!split && 'opacity-50'">
    <span
      v-for="pill in pills"
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
      <template v-if="split && pill.value > 0.06">{{ percent(pill.value) }}<template v-if="pill.value > pill.min">&nbsp;{{ pill.label }}</template></template>
    </span>
  </div>
</template>
