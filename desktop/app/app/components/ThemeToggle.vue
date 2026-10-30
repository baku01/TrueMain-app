<script setup lang="ts">
/** The light / dark switch of the top bar: dark until the player chooses, then remembered. */
const { t } = useLocale()
const colorMode = useColorMode()
const dark = computed(() => colorMode.value === 'dark')

function toggle() {
  colorMode.preference = dark.value ? 'light' : 'dark'
}
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
