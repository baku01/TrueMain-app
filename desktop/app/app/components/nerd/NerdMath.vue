<script setup lang="ts">
/**
 * One line of a formula, typeset as a paper would: a math face (STIX Two on
 * macOS, Cambria Math on Windows), `^{…}` raised and `_{…}` lowered. Plain
 * text in, spans out — no HTML is ever parsed from it.
 */
const props = defineProps<{ text: string }>()

const segments = computed(() => {
  const out: { kind: 'base' | 'sup' | 'sub', text: string }[] = []
  const pattern = /([\^_])\{([^}]*)\}/g
  let last = 0
  for (const match of props.text.matchAll(pattern)) {
    if (match.index! > last) out.push({ kind: 'base', text: props.text.slice(last, match.index) })
    out.push({ kind: match[1] === '^' ? 'sup' : 'sub', text: match[2]! })
    last = match.index! + match[0].length
  }
  if (last < props.text.length) out.push({ kind: 'base', text: props.text.slice(last) })
  return out
})
</script>

<template>
  <span class="nerd-math"><template v-for="(segment, index) in segments" :key="index"><sup v-if="segment.kind === 'sup'">{{ segment.text }}</sup><sub v-else-if="segment.kind === 'sub'">{{ segment.text }}</sub><template v-else>{{ segment.text }}</template></template></span>
</template>

<style>
.nerd-math {
  font-family: 'STIX Two Math', 'STIX Two Text', 'Cambria Math', Cambria, 'Latin Modern Math', 'Times New Roman', serif;
  font-size: 1.08em;
  letter-spacing: 0.01em;
}

.nerd-math sup,
.nerd-math sub {
  font-size: 0.72em;
  line-height: 0;
}
</style>
