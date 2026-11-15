<script setup lang="ts">
/**
 * Whether what people wrote shows machine-translated (`utils/translate`) or
 * as written: a badge while the translation is on its way, and a switch to
 * the original and back, for every guide at once.
 */
defineProps<{ translating: boolean }>()
const { t } = useT()
const { original } = useGuideTranslation()
</script>

<template>
  <div class="flex items-center gap-2">
    <span class="flex items-center gap-1.5 text-xs text-muted">
      <UIcon :name="translating ? 'i-lucide-loader-circle' : 'i-lucide-languages'" class="size-3.5" :class="translating && 'animate-spin'" />
      {{ original ? t('guides.original') : translating ? t('guides.translating') : t('guides.translated') }}
    </span>
    <UButton :label="original ? t('guides.showTranslation') : t('guides.showOriginal')" color="neutral" variant="soft" size="xs" @click="original = !original" />
  </div>
</template>
