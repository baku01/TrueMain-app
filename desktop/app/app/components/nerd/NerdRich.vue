<script setup lang="ts">
/**
 * A takeaway sentence with its figures in bold: `**…**` in the message marks
 * them. Plain text in, spans out — no HTML is ever parsed from it.
 */
const props = defineProps<{ text: string }>()

const parts = computed(() => props.text.split('**').map((text, index) => ({ text, bold: index % 2 === 1 })).filter(part => part.text))
</script>

<template>
  <span><template v-for="(part, index) in parts" :key="index"><b v-if="part.bold" class="font-semibold text-highlighted tabular-nums">{{ part.text }}</b><template v-else>{{ part.text }}</template></template></span>
</template>
