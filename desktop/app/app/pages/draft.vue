<script setup lang="ts">
/**
 * Champion select. The gameflow phase opens this page on its own when one
 * starts (`app.vue`); outside of it the page waits for the next.
 *
 * In development a champion select can be played by hand, as the client would
 * send it, from `/dev/draft-sim` — see desktop/README.md.
 */
const { state, screen } = useLcuState()
const { t } = useT()
</script>

<template>
  <DraftScreen v-if="screen === 'draft' && state.draft" :draft="state.draft" />

  <div v-else class="relative flex h-full flex-col items-center justify-center gap-5 overflow-hidden px-8 text-center">
    <ChampionArt :alias="backdropAlias()" fade="vignette" position="60% 25%" class="opacity-40" />
    <span v-if="state.connected" class="relative flex size-3 items-center justify-center">
      <span class="absolute inline-flex size-full animate-tm-pulse rounded-full bg-primary" />
      <span class="relative inline-flex size-1.5 rounded-full bg-primary" />
    </span>
    <span v-else class="relative flex size-9 items-center justify-center rounded-full bg-warning/15 text-warning ring-1 ring-warning/30">
      <UIcon name="i-lucide-unplug" class="size-4" />
    </span>
    <div class="relative space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ t('draft.page.title') }}</h1>
      <p class="max-w-sm text-sm text-muted">
        {{ state.connected ? t('draft.page.connected') : t('draft.page.disconnected') }}
      </p>
    </div>
    <div class="relative flex flex-wrap items-center justify-center gap-2">
      <UButton to="/matchup" icon="i-lucide-wand-sparkles" :label="t('app.page.matchup')" color="neutral" variant="soft" size="sm" />
      <UButton to="/jev" icon="i-tabler-chess-knight" :label="t('app.page.jev')" color="neutral" variant="soft" size="sm" />
    </div>
  </div>
</template>
