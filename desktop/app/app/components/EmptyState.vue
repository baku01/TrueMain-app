<script setup lang="ts">
/** A page with nothing to show yet: a tile with the page's icon, what it is for, and the way to start. */
defineProps<{
  icon: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-1 flex-col items-center justify-center px-6 text-center">
    <span class="grid size-16 place-items-center rounded-2xl border border-default bg-elevated text-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]">
      <UIcon :name="icon" class="size-8" />
    </span>
    <h2 class="mt-5 max-w-md text-lg font-semibold tracking-tight text-highlighted">{{ title }}</h2>
    <p v-if="description" class="mt-1.5 max-w-sm text-sm text-muted">{{ description }}</p>
    <div class="mt-5 flex items-center gap-2"><slot /></div>
  </div>
</template>
