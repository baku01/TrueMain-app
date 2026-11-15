<script setup lang="ts">
/**
 * A card's header: its emblem, its plain title with the technical name of the
 * method beside it, small — for the reader who wants to look it up — and a
 * line under them; the card's controls in the slot.
 */
defineProps<{
  icon: string
  title: string
  /** The statistics' own name for it (`Cohen's d`, `Wald–Wolfowitz`). */
  technical?: string
  subtitle?: string
}>()

const { t } = useT()
</script>

<template>
  <header class="flex flex-wrap items-center gap-3 border-b border-default px-4 py-3.5">
    <span class="tm-emblem grid size-9 shrink-0 place-items-center rounded-lg text-primary">
      <UIcon :name="icon" class="size-5" />
    </span>
    <div class="min-w-0 flex-1">
      <h2 class="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-highlighted">
        {{ title }}
        <span v-if="technical" class="nerd-tech" :title="t('nerd.technicalName')">{{ technical }}</span>
      </h2>
      <p v-if="subtitle" class="mt-0.5 text-xs text-muted">{{ subtitle }}</p>
    </div>
    <slot />
  </header>
</template>

<style>
/* The technical name of a method, beside its plain title: small, quiet, there to be looked up. */
.nerd-tech {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0 0.375rem;
  border-radius: 0.25rem;
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1.125rem;
  color: var(--ui-text-dimmed);
  background: color-mix(in oklch, var(--ui-bg-elevated) 60%, transparent);
  box-shadow: inset 0 0 0 1px var(--ui-border);
}
</style>
