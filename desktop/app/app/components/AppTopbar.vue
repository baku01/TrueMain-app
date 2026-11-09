<script setup lang="ts">
/**
 * The bar across the window's top: the wordmark, a
 * champion and player search (⌘K) in the middle, and on the right the theme
 * and language buttons and the player. Settings sit at the foot of the rail
 * (`AppNav`), which is how the app is navigated. No back/forward arrows and no
 * patch label — browser chrome that made the window read as a web page. The
 * app never *opens* on the search — it opens on the player — but a champion
 * is always two keystrokes away. In a bar too narrow for it (a compact
 * window, #1914) the field folds into its icon; the shortcut stays.
 */
const open = ref(false)
const { t } = useLocale()
// A downloaded update stays one click away after its toast is gone.
const { readyVersion: updateVersion, installing: updating, stalled: updateStalled, restart: restartToUpdate } = useAppUpdate()

defineShortcuts({
  meta_k: () => (open.value = !open.value),
})
</script>

<template>
  <!-- "deep": the whole bar drags the window, as a native title bar does; buttons, links and the search still take their clicks. -->
  <header data-tauri-drag-region="deep" class="app-topbar @container grid grid-cols-[1fr_minmax(0,28rem)_1fr] items-center gap-3 px-4">
    <div class="flex min-w-0 items-center gap-2.5">
      <NuxtLink to="/" :aria-label="t('nav.dashboard')" class="shrink-0">
        <AppWordmark class="text-lg" />
      </NuxtLink>
      <UButton
        v-if="updateVersion"
        :label="t('sidebar.update', { version: updateVersion })"
        icon="i-lucide-download"
        size="xs"
        variant="soft"
        class="shrink-0"
        :loading="updating && !updateStalled"
        @click="restartToUpdate"
      />
    </div>

    <button
      type="button"
      :aria-label="t('topbar.searchLabel')"
      class="flex h-8 w-full items-center gap-2 rounded-lg bg-muted px-3 text-sm text-dimmed ring-1 ring-inset ring-(--ui-border) transition-colors hover:text-muted hover:ring-(--ui-border-accented) @max-xl:ml-auto @max-xl:w-8 @max-xl:justify-center @max-xl:px-0"
      @click="open = true"
    >
      <UIcon name="i-lucide-search" class="size-4 shrink-0" />
      <span class="truncate @max-xl:hidden">{{ t('topbar.searchPlaceholder') }}</span>
      <span class="ml-auto flex items-center gap-0.5 @max-xl:hidden">
        <UKbd value="meta" size="sm" />
        <UKbd value="K" size="sm" />
      </span>
    </button>

    <div class="flex min-w-0 items-center justify-end gap-1">
      <ThemeToggle class="app-btn shrink-0" />
      <LanguageSwitcher class="app-btn shrink-0" />
      <span class="mx-1.5 h-5 w-px shrink-0 bg-(--ui-border-accented)" aria-hidden="true" />
      <AppPlayerCard class="min-w-0" />
    </div>

    <ChampionSearch v-model:open="open" />
  </header>
</template>
