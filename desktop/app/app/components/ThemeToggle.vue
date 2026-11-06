<script setup lang="ts">
/**
 * The light / dark switch of the top bar: dark until the player chooses, then
 * remembered. Under a Catppuccin theme it goes between Latte and the dark
 * flavour last used (`useAppTheme`).
 */
const { t } = useLocale()
const colorMode = useColorMode()
const { toggleMode } = useAppTheme()
const dark = computed(() => colorMode.value === 'dark')
const toggle = () => toggleMode()
</script>

<template>
  <ClientOnly>
    <UTooltip :text="dark ? t('theme.light') : t('theme.dark')">
      <UButton
        :icon="dark ? 'i-lucide-sun' : 'i-lucide-moon'"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="dark ? t('theme.light') : t('theme.dark')"
        @click="toggle"
      />
    </UTooltip>
  </ClientOnly>
</template>
