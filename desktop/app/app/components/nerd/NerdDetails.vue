<script setup lang="ts">
/**
 * "Show the maths": the figures behind a card's plain reading — the test
 * values, the formula — folded away until asked for, each symbol beside a
 * one-line meaning in plain words. Its contents are only drawn once opened.
 */
defineProps<{
  label?: string
  /** Each symbol (typeset by `NerdMath`), its value here, and what it means. */
  symbols?: { symbol: string, value?: string, meaning: string }[]
}>()

const { t } = useT()
const open = ref(false)
const drawn = ref(false)
function toggle() {
  drawn.value = true
  open.value = !open.value
}
</script>

<template>
  <div class="nerd-details">
    <button type="button" class="nerd-details-toggle" :aria-expanded="open" @click="toggle">
      <UIcon name="i-tabler-math-function" class="size-3.5" />
      {{ open ? t('nerd.details.hide') : label ?? t('nerd.details.show') }}
      <UIcon name="i-lucide-chevron-down" class="size-3.5 transition-transform duration-300" :class="open ? 'rotate-180' : ''" />
    </button>
    <div class="nerd-details-body" :data-open="open || undefined">
      <div class="min-h-0 overflow-hidden">
        <div v-if="drawn" class="space-y-3 pt-3">
          <dl v-if="symbols?.length" class="nerd-symbols">
            <template v-for="entry in symbols" :key="entry.symbol">
              <dt class="whitespace-nowrap text-highlighted">
                <NerdMath :text="entry.symbol" /><span v-if="entry.value" class="tabular-nums"> = {{ entry.value }}</span>
              </dt>
              <dd class="text-muted">{{ entry.meaning }}</dd>
            </template>
          </dl>
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nerd-details-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ui-text-muted);
  background: color-mix(in oklch, var(--ui-bg-elevated) 55%, transparent);
  box-shadow: inset 0 0 0 1px var(--ui-border);
  transition: color 150ms, box-shadow 150ms;
}

.nerd-details-toggle:hover,
.nerd-details-toggle[aria-expanded='true'] {
  color: var(--ui-primary);
  box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--ui-primary) 40%, transparent);
}

.nerd-details-body {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 320ms var(--tm-ease), opacity 220ms ease;
}

.nerd-details-body[data-open] {
  grid-template-rows: 1fr;
  opacity: 1;
}

.nerd-symbols {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.375rem 0.875rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 12px;
  line-height: 1.45;
  background: var(--tm-pane-2);
  box-shadow: inset 0 0 0 1px var(--ui-border);
}

@media (prefers-reduced-motion: reduce) {
  .nerd-details-body {
    transition: none;
  }
}
</style>
