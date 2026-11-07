<script setup lang="ts">
import type { OverlayPanelSettings } from '~/types/overlay'
import type { TipCategory } from '~/utils/tips/catalogue'
import { CATEGORY_ICONS, TIP_CATEGORIES } from '~/utils/tips/catalogue'

/**
 * The in-game tips on the Overlay page: on or off, each category, and the
 * voice (`OverlayVoicePacks`). The tips show in the objectives panel's
 * window, under its strip, so they follow that panel: switched off, or up
 * only on its chord, it takes them with it — said here, by the switch.
 */
const props = defineProps<{ objectives: OverlayPanelSettings }>()

const { t } = useT()
const { settings, update } = useTipSettings()

const where = computed(() => {
  if (!props.objectives.enabled) return { text: t('tips.whereOff'), warn: true }
  if (props.objectives.trigger.kind !== 'always') return { text: t('tips.whereHeld'), warn: true }
  return { text: t('tips.where'), warn: false }
})

function toggle(category: TipCategory) {
  update({ categories: { ...settings.value.categories, [category]: !settings.value.categories[category] } })
}
</script>

<template>
  <section class="space-y-4 surface rounded-xl p-5" data-tips-settings>
    <header class="flex items-start gap-3">
      <UIcon name="i-lucide-message-square-text" class="mt-0.5 size-5 shrink-0 text-primary" />
      <div class="min-w-0 flex-1 space-y-1">
        <h2 class="text-sm font-semibold text-highlighted">{{ t('tips.title') }}</h2>
        <p class="text-xs text-muted">{{ t('tips.description') }}</p>
      </div>
      <USwitch :model-value="settings.enabled" :label="t('tips.show')" @update:model-value="update({ enabled: $event })" />
    </header>

    <p class="flex items-start gap-2 rounded-lg px-3 py-2 text-xs" :class="where.warn ? 'bg-warning/10 text-warning' : 'bg-accented/50 text-muted'">
      <UIcon :name="where.warn ? 'i-lucide-triangle-alert' : 'i-lucide-info'" class="mt-0.5 size-3.5 shrink-0" />
      {{ where.text }}
    </p>

    <div class="space-y-2" :class="!settings.enabled && 'pointer-events-none opacity-50'">
      <h3 class="stat-label">{{ t('tips.categories') }}</h3>
      <div class="flex flex-wrap gap-1.5">
        <UButton
          v-for="category in TIP_CATEGORIES"
          :key="category"
          :label="t(`tips.category.${category}`)"
          :icon="CATEGORY_ICONS[category]"
          size="xs"
          :color="settings.categories[category] ? 'primary' : 'neutral'"
          :variant="settings.categories[category] ? 'soft' : 'ghost'"
          role="switch"
          :aria-checked="settings.categories[category]"
          :data-category="category"
          @click="toggle(category)"
        />
      </div>
    </div>

    <OverlayVoicePacks />
  </section>
</template>
