<script setup lang="ts">
import { LOCALES } from '#common/utils/i18n'

const { locale, setLocale, t } = useLocale()

const items = computed(() => LOCALES.map(option => ({
  label: option.label,
  type: 'checkbox' as const,
  checked: locale.value === option.code,
  onUpdateChecked: () => setLocale(option.code),
})))
</script>

<template>
  <UDropdownMenu :items="items">
    <UButton
      icon="i-lucide-languages"
      color="neutral"
      variant="ghost"
      size="sm"
      :aria-label="t('language.label')"
    />
  </UDropdownMenu>
</template>
