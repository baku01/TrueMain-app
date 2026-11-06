<script setup lang="ts">
/**
 * The desktop app's tier mark: the S/A/B/C/D letter cut into a small crest,
 * one metal per tier — blue steel for S, gold, silver, bronze, iron —, a
 * chevron under its point, drawn as one SVG so it stays crisp at any size.
 * In a list it is the crest alone; `stacked`, for a mark laid over champion
 * art, is a larger one with the metal's glow and a "tier" caption, which is
 * what lets it be read on any splash. It replaces the shared layer's bare
 * coloured letter for this app only (a component of the app wins over the
 * layer's of the same name); the props are the layer's, plus `size`.
 */
const props = defineProps<{
  /** Tier letter from the API: 'S' | 'A' | 'B' | 'C' | 'D'. */
  tier: string
  stacked?: boolean
  /** The crest's side in pixels; 22 in a list, 44 stacked. */
  size?: number
  /** The "tier" caption under a stacked mark; off where the card is too small for it. */
  caption?: boolean
}>()

// Per tier: the metal's light and dark stops, its shine and its glow — a Catppuccin theme's own (`--tm-metal-*`), else these.
const metalOf = (tier: string, light: string, dark: string, shine: string, glow: string) => ({
  light: `var(--tm-metal-${tier}-light, ${light})`,
  dark: `var(--tm-metal-${tier}-dark, ${dark})`,
  shine: `var(--tm-metal-${tier}-shine, ${shine})`,
  glow: `var(--tm-metal-${tier}-glow, ${glow})`,
})
const METALS: Record<string, { light: string, dark: string, shine: string, glow: string }> = {
  S: metalOf('s', '#d6e8ff', '#2f6fe4', '#f2f8ff', 'rgb(96 165 250 / 0.7)'),
  A: metalOf('a', '#ffe7a0', '#c8921f', '#fff6d6', 'rgb(226 185 92 / 0.55)'),
  B: metalOf('b', '#f3f6fa', '#97a2b2', '#ffffff', 'rgb(185 194 205 / 0.35)'),
  C: metalOf('c', '#f3bf8c', '#9b5a27', '#ffe2c6', 'rgb(179 118 63 / 0.35)'),
  D: metalOf('d', '#a7a2a8', '#56525a', '#cfcbd0', 'transparent'),
}

const { t } = useT()
const uid = useId()
const normalized = computed(() => props.tier?.toUpperCase() ?? '')
const metal = computed(() => METALS[normalized.value] ?? null)
const side = computed(() => props.size ?? (props.stacked ? 44 : 22))
const ariaLabel = computed(() => (metal.value ? tr('common.tierLetter', { tier: normalized.value }) : tr('common.tierUnknown')))
const glow = computed(() => (props.stacked && metal.value ? { filter: `drop-shadow(0 0 ${Math.round(side.value / 5)}px ${metal.value.glow})` } : undefined))
</script>

<template>
  <span class="inline-flex shrink-0 flex-col items-center leading-none" role="img" :aria-label="ariaLabel">
    <svg v-if="metal" :width="side" :height="side" viewBox="0 0 28 28" fill="none" :style="glow" aria-hidden="true">
      <defs>
        <linearGradient :id="`${uid}-metal`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" :style="{ stopColor: metal.light }" />
          <stop offset="1" :style="{ stopColor: metal.dark }" />
        </linearGradient>
      </defs>
      <!-- The dark rim that sets the crest off any background, art included. -->
      <path d="M7.5 2.5h13A4 4 0 0 1 24.5 6.5v10.2a2 2 0 0 1-.9 1.66L14 24.6l-9.6-6.24a2 2 0 0 1-.9-1.66V6.5a4 4 0 0 1 4-4Z" fill="#0c0e13" />
      <path d="M3.5 19.6 14 26.4l10.5-6.8v2.1L14 28.5 3.5 21.7Z" fill="#0c0e13" />
      <!-- The face, the chevron under it, and the shine along the top edge. -->
      <path d="M8 4.2h12A2.8 2.8 0 0 1 22.8 7v9.3a1 1 0 0 1-.45.84L14 22.6l-8.35-5.46a1 1 0 0 1-.45-.84V7A2.8 2.8 0 0 1 8 4.2Z" :fill="`url(#${uid}-metal)`" />
      <path d="M5.2 19.9 14 25.6l8.8-5.7v1.1L14 26.7l-8.8-5.7Z" :style="{ fill: metal.dark }" />
      <path d="M7.2 4.9h13.6" :style="{ stroke: metal.shine }" stroke-width="0.7" stroke-linecap="round" opacity="0.8" />
      <text x="14" y="13.6" text-anchor="middle" dominant-baseline="central" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="800" fill="#0c0e13">{{ normalized }}</text>
    </svg>
    <span v-else class="inline-flex h-6 min-w-7 items-center justify-center font-mono text-sm font-bold text-muted">–</span>
    <span v-if="stacked && caption !== false" class="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-default/80">{{ t('common.tier') }}</span>
  </span>
</template>
