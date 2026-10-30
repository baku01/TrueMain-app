<script setup lang="ts">
/**
 * The desktop app's tier mark: the S/A/B/C/D letter, one metal per tier —
 * blue steel for S, gold, silver, bronze, iron. In a list it is a flat outlined
 * square, nothing more; `stacked`, for a mark laid over champion art, is the
 * larger shield medal with a glow and a "tier" caption, which is what lets it
 * be read on any splash. It replaces the shared layer's bare coloured letter
 * for this app only (a component of the app wins over the layer's of the same
 * name); the props are the layer's.
 */
const props = defineProps<{
  /** Tier letter from the API: 'S' | 'A' | 'B' | 'C' | 'D'. */
  tier: string
  stacked?: boolean
}>()

// Per tier: the metal's light and dark edge, the letter's colour and the glow.
const METALS: Record<string, { light: string, dark: string, letter: string, glow: string }> = {
  S: { light: '#bfdbfe', dark: '#2563eb', letter: '#dbeafe', glow: 'rgb(96 165 250 / 0.65)' },
  A: { light: '#f7dc8a', dark: '#b8862b', letter: '#fde9a8', glow: 'rgb(226 185 92 / 0.5)' },
  B: { light: '#eef1f5', dark: '#8a94a3', letter: '#e6eaf0', glow: 'rgb(185 194 205 / 0.3)' },
  C: { light: '#e3a468', dark: '#8a4f22', letter: '#f0c49a', glow: 'rgb(179 118 63 / 0.3)' },
  D: { light: '#a59a9e', dark: '#5c5456', letter: '#bdb3b6', glow: 'transparent' },
}

const { t } = useT()
const normalized = computed(() => props.tier?.toUpperCase() ?? '')
const metal = computed(() => METALS[normalized.value] ?? null)
const label = computed(() => (metal.value ? normalized.value : '–'))
const ariaLabel = computed(() => (metal.value ? tr('common.tierLetter', { tier: normalized.value }) : tr('common.tierUnknown')))
const style = computed(() => (metal.value
  ? {
      '--light': metal.value.light,
      '--dark': metal.value.dark,
      '--letter': metal.value.letter,
      '--glow': metal.value.glow,
      'filter': props.stacked ? `drop-shadow(0 0 10px ${metal.value.glow})` : undefined,
    }
  : undefined))
</script>

<template>
  <span class="inline-flex flex-col items-center leading-none" :aria-label="ariaLabel">
    <span
      v-if="metal && stacked"
      class="relative grid size-12 place-items-center"
      :style="style"
    >
      <span class="medal absolute inset-0" />
      <span class="medal-face absolute inset-[2px]" />
      <span
        class="relative font-mono text-xl font-extrabold tracking-tight [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]"
        :style="{ color: 'var(--letter)' }"
      >{{ label }}</span>
    </span>
    <span
      v-else-if="metal"
      class="tier-flat inline-grid size-6 place-items-center rounded-md border font-mono text-[13px] font-bold"
      :style="style"
    >{{ label }}</span>
    <span v-else class="inline-flex h-6 min-w-7 items-center justify-center font-mono text-sm font-bold text-muted">–</span>
    <span v-if="stacked" class="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-default/80">{{ t('common.tier') }}</span>
  </span>
</template>

<style scoped>
/* A shield: wide shoulders, a pointed foot. The rim is the metal's gradient, the face a dark pane tinted with it. */
.medal,
.medal-face {
  clip-path: polygon(50% 0%, 100% 14%, 100% 62%, 50% 100%, 0% 62%, 0% 14%);
}
.medal {
  background: linear-gradient(160deg, var(--light), var(--dark));
}
.medal-face {
  background:
    linear-gradient(180deg, color-mix(in oklch, var(--dark) 38%, #0b0b0d), color-mix(in oklch, var(--dark) 14%, #0b0b0d));
}

/* Flat, in a list: the metal's light edge on a dark page (`main.css` swaps in the dark edge on a light one, where the light would vanish). */
.tier-flat {
  color: var(--light);
  border-color: color-mix(in oklch, var(--light) 55%, transparent);
  background: color-mix(in oklch, var(--light) 10%, transparent);
}
</style>
