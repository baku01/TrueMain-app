<script setup lang="ts">
/**
 * The bar over the content: the sidebar's fold button (⌘B), a champion search
 * (⌘K) and the language menu, and nothing else. No
 * back/forward arrows and no patch label — browser chrome that made the window
 * read as a web page; the sidebar is how the app is navigated. The app never
 * *opens* on the search — it opens on the player — but a champion is always
 * two keystrokes away. In a bar too narrow for it (a compact window, #1914)
 * the field folds into its icon; the shortcut stays.
 */
const open = ref(false)
const { t } = useLocale()
const { collapsed, canToggle, toggle } = useSidebar()

defineShortcuts({
  meta_k: () => (open.value = !open.value),
  meta_b: toggle,
})
</script>

<template>
  <header class="@container flex items-center px-4">
    <UTooltip v-if="canToggle" :text="collapsed ? t('sidebar.expand') : t('sidebar.collapse')" :kbds="['meta', 'B']">
      <UButton
        :icon="collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
        color="neutral"
        variant="ghost"
        size="sm"
        class="mr-2 shrink-0"
        :aria-label="collapsed ? t('sidebar.expand') : t('sidebar.collapse')"
        :aria-expanded="!collapsed"
        @click="toggle"
      />
    </UTooltip>
    <button
      type="button"
      :aria-label="t('topbar.searchLabel')"
      class="mx-auto flex h-8 w-full max-w-md items-center gap-2 rounded-lg border border-default bg-elevated px-3 text-sm text-dimmed transition-colors hover:border-accented hover:text-muted @max-sm:ml-auto @max-sm:mr-0 @max-sm:w-8 @max-sm:justify-center @max-sm:px-0"
      @click="open = true"
    >
      <UIcon name="i-lucide-search" class="size-4 shrink-0" />
      <span class="@max-sm:hidden">{{ t('topbar.searchPlaceholder') }}</span>
      <span class="ml-auto flex items-center gap-0.5 @max-sm:hidden">
        <UKbd value="meta" size="sm" />
        <UKbd value="K" size="sm" />
      </span>
    </button>

    <UTooltip :text="t('nav.settings')">
      <UButton to="/settings" icon="i-ph-gear-six-light" color="neutral" variant="ghost" size="sm" class="ml-2 shrink-0" :aria-label="t('nav.settings')" />
    </UTooltip>
    <ThemeToggle class="ml-1 shrink-0" />
    <LanguageSwitcher class="ml-1 shrink-0" />

    <ChampionSearch v-model:open="open" />
  </header>
</template>
