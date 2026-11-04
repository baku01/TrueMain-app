<script setup lang="ts">
/**
 * The draft's automatic import (`useAutoImport`): a switch per part, all off
 * until the player turns them on, and the key Flash goes on.
 */
const { t } = useT()
const { settings, update } = useAutoImport()
const PARTS = ['runes', 'items', 'spells'] as const
</script>

<template>
  <section class="space-y-4 surface rounded-xl p-5">
    <header class="space-y-1">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-download" class="size-5 text-primary" />
        <h2 class="text-sm font-semibold text-highlighted">{{ t('autoImport.title') }}</h2>
      </div>
      <p class="text-xs text-muted">{{ t('autoImport.description') }}</p>
    </header>

    <USwitch
      v-for="part in PARTS"
      :key="part"
      :model-value="settings[part]"
      :label="t(`autoImport.${part}`)"
      :description="t(`autoImport.${part}Description`)"
      @update:model-value="update({ [part]: $event })"
    />

    <div v-if="settings.spells" class="flex items-center gap-3 pl-11">
      <span class="text-sm text-default">{{ t('autoImport.flash') }}</span>
      <div class="flex gap-1" role="radiogroup" :aria-label="t('autoImport.flash')">
        <UButton
          v-for="key in (['D', 'F'] as const)"
          :key="key"
          :label="key"
          size="xs"
          :color="settings.flash === key ? 'primary' : 'neutral'"
          :variant="settings.flash === key ? 'soft' : 'ghost'"
          role="radio"
          :aria-checked="settings.flash === key"
          @click="update({ flash: key })"
        />
      </div>
    </div>
  </section>
</template>
