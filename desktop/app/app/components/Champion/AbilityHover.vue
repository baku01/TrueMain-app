<script setup lang="ts">
import AbilityHoverCard from '~/components/Champion/AbilityHoverCard.vue'

/**
 * An ability's icon that, under the pointer, shows the ability as Blitz does:
 * its clip playing over its name, its description with every figure and its
 * cooldown, cost and range (`AbilityHoverCard`). The tooltip, and the read of
 * the champion's abilities, only happen once the pointer is there
 * (`GameTooltipLazyTooltip`).
 */
defineProps<{ championId: number, spellKey: 'P' | 'Q' | 'W' | 'E' | 'R' }>()
</script>

<template>
  <GameTooltipLazyTooltip :delay-duration="150" :ui="{ content: 'h-auto p-0 overflow-hidden' }" :content="{ side: 'top', collisionPadding: 12 }">
    <slot />
    <template #content>
      <AbilityHoverCard :champion-id="championId" :spell-key="spellKey" />
    </template>
  </GameTooltipLazyTooltip>
</template>
