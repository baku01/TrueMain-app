<script setup lang="ts">
/** The site's M-check mark alone: an M whose last stroke becomes a checkmark, on the app's blue ramp. */
// Each instance names its own gradient: two marks on one page would otherwise share the first one's.
const gradient = `tm-mark-${useId()}`
</script>

<template>
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient :id="gradient" x1="0" y1="0" x2="0" y2="1">
        <!-- The theme's accent (`--tm-mark-*`, a Catppuccin flavour's); the app's blue ramp otherwise. -->
        <stop offset="0" :style="{ stopColor: 'var(--tm-mark-1, #a5d4ff)' }" />
        <stop offset="0.55" :style="{ stopColor: 'var(--tm-mark-2, #3b97f7)' }" />
        <stop offset="1" :style="{ stopColor: 'var(--tm-mark-3, #1659ad)' }" />
      </linearGradient>
    </defs>
    <path
      d="M13 47V21l15 17L51 15"
      fill="none"
      :stroke="`url(#${gradient})`"
      stroke-width="8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
