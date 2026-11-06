<script setup lang="ts">
/**
 * The lobby builds of a queue with no champion select (Swiftplay). The
 * gameflow opens this page on its own in such a lobby (`app.vue`), as champion
 * select opens the draft; outside of one the page waits for the next.
 */
const { state, screen } = useLcuState()
const { t } = useT()
</script>

<template>
  <LobbyScreen v-if="screen === 'lobby' && state.lobby" :lobby="state.lobby" :phase="state.phase" />

  <div v-else class="relative flex h-full flex-col items-center justify-center gap-5 overflow-hidden px-8 text-center">
    <ChampionArt :alias="backdropAlias()" fade="vignette" position="60% 25%" class="opacity-40" />
    <span class="relative flex size-3 items-center justify-center">
      <span class="absolute inline-flex size-full animate-tm-pulse rounded-full bg-primary" />
      <span class="relative inline-flex size-1.5 rounded-full bg-primary" />
    </span>
    <div class="relative space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ t('lobby.page.title') }}</h1>
      <p class="max-w-sm text-sm text-muted">
        {{ state.connected ? t('lobby.page.connected') : t('lobby.page.disconnected') }}
      </p>
    </div>
  </div>
</template>
