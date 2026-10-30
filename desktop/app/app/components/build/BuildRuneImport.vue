<script setup lang="ts">
import type { KitRunePage } from '#shared/types/kit'

/**
 * The rune import button (#1678): a small icon in the corner of the runes,
 * there whenever the client is, out of the way of the page it imports. The
 * label lives in its tooltip; the toast says how it went.
 */
const props = defineProps<{
  page: KitRunePage
  champion: string
}>()

const { t } = useT()
const { available, pending, done, importRunes } = useRuneImport()
</script>

<template>
  <UTooltip v-if="available" :text="done ? t('build.imported') : t('build.importRunes')" :content="{ side: 'left' }">
    <UButton
      size="xs"
      color="neutral"
      variant="ghost"
      square
      :icon="done ? 'i-lucide-check' : 'i-lucide-download'"
      :loading="pending"
      :aria-label="t('build.importRunes')"
      class="text-dimmed hover:text-highlighted"
      @click="importRunes(props.page, props.champion)"
    />
  </UTooltip>
</template>
