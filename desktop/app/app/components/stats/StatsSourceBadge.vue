<script setup lang="ts">
import type { DataSource } from '~/utils/data-source'
import { dataSource } from '~/utils/data-source'

/**
 * The source a view's numbers actually came from, as the pros' list names
 * Blitz: the picked one, or the one that stood in because the picked source
 * does not measure them — then the tooltip says so.
 */
const props = defineProps<{ source: DataSource }>()
const { t } = useT()
const name = computed(() => t(`source.name.${props.source}`))
const standIn = computed(() => props.source !== dataSource.value)
</script>

<template>
  <UBadge
    :label="t('stats.source', { source: name })"
    :icon="standIn ? 'i-lucide-info' : undefined"
    :title="standIn ? t('stats.sourceStandIn', { source: name, picked: t(`source.name.${dataSource}`) }) : undefined"
    color="primary"
    variant="subtle"
    size="sm"
    class="shrink-0 normal-case tracking-normal"
  />
</template>
