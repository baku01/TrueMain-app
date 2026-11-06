<script setup lang="ts">
// The source a card's numbers came from, named small in its corner: a read
// falls back from the source picked to the next one that carries the data, so
// the pick alone does not say whose they are. `local` is this machine's own
// record, `client` the League client's games.
const props = defineProps<{ source: string }>()
const { t } = useT()
const name = computed(() => t(`source.name.${props.source}`))
</script>

<template>
  <span
    class="shrink-0 rounded px-1.5 text-[10px] font-medium leading-4 text-dimmed ring-1 ring-default"
    :title="t('dash.source.from', { source: name })"
    data-testid="source-badge"
  >{{ name }}</span>
</template>
