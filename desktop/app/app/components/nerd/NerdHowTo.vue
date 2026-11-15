<script setup lang="ts">
/** A chart's one-sentence "how to read it", under the chart. */
defineProps<{ text: string }>()

const { t } = useT()
</script>

<template>
  <p class="flex items-start gap-1.5 text-[11px] leading-relaxed text-dimmed">
    <UIcon name="i-tabler-eye" class="mt-px size-3.5 shrink-0" />
    <span><b class="font-semibold text-muted">{{ t('nerd.howTo') }}</b> {{ text }}</span>
  </p>
</template>
