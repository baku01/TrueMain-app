<script setup lang="ts">
/** One section of the rail (`AppNav`): its icon, its name unless the rail is folded, then a tooltip instead. */
defineProps<{
  tab: { label: string, icon: string, to: string, active: boolean, lit?: { dot: string, label: string } }
  compact: boolean
}>()
</script>

<template>
  <UTooltip :text="tab.label" :disabled="!compact" :content="{ side: 'right' }">
    <NuxtLink
      :to="tab.to"
      class="rail-item"
      :data-active="tab.active || undefined"
      :aria-current="tab.active ? 'page' : undefined"
      :aria-label="tab.lit ? `${tab.label} · ${tab.lit.label}` : compact ? tab.label : undefined"
    >
      <span class="relative flex shrink-0">
        <UIcon :name="tab.icon" class="rail-icon size-[18px]" />
        <span v-if="tab.lit" class="absolute -right-1 -top-1 size-1.5 rounded-full ring-2 ring-(--ui-bg-elevated)" :class="tab.lit.dot" />
      </span>
      <span v-if="!compact" class="truncate">{{ tab.label }}</span>
    </NuxtLink>
  </UTooltip>
</template>
