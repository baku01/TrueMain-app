<script setup lang="ts">
/**
 * What shows while a translation comes (`useGuideTranslation`): a short light
 * running along the edge it is laid on, in the app's accent — the page stays
 * readable under it as the author wrote it, each part replaced as its
 * translation arrives. No word, no service named: the app's language is all
 * the player chose.
 */
</script>

<template>
  <span class="guide-glint pointer-events-none absolute inset-x-0 -bottom-px h-px" aria-hidden="true" />
</template>

<style scoped>
.guide-glint {
  background: linear-gradient(90deg, transparent, var(--ui-primary), transparent) no-repeat;
  background-size: 30% 100%;
  animation: guide-glint 1.4s ease-in-out infinite;
}

@keyframes guide-glint {
  from { background-position: -30% 0; }
  to { background-position: 130% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .guide-glint { animation: none; background-size: 100% 100%; opacity: 0.4; }
}
</style>
