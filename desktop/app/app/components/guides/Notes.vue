<script setup lang="ts">
/** An author's notes on a part of their build: MOBAFire keeps them behind an icon, a click away here too. */
defineProps<{ notes: string | null }>()
const { t } = useT()
</script>

<template>
  <UPopover v-if="notes" :content="{ align: 'end', sideOffset: 6 }">
    <UButton icon="i-lucide-notebook-pen" :label="t('guides.notes')" color="neutral" variant="ghost" size="xs" />
    <template #content>
      <p class="max-w-sm whitespace-pre-line p-3 text-xs leading-relaxed text-default">{{ notes }}</p>
    </template>
  </UPopover>
</template>
