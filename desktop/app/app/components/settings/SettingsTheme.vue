<script setup lang="ts">
import type { AppTheme } from '~/utils/app-theme'
import { APP_THEMES, isFlavor } from '~/utils/app-theme'
import { ACCENTS, PALETTES } from '~/utils/catppuccin'

/**
 * The theme (`useAppTheme`): TrueMain's or a Catppuccin flavour, each card a
 * small picture of its page — the page, a pane on it, the accent and the text
 * — and, under a flavour, its fourteen accents.
 */
const { t } = useT()
const { choice, setTheme, setAccent } = useAppTheme()

/** What a card draws: TrueMain's dark navy, or the flavour's own tones in the accent picked. */
function preview(theme: AppTheme) {
  if (!isFlavor(theme)) return { page: '#080c14', pane: '#101827', accent: '#52a8ff', text: '#e8eef9', dim: '#61708a' }
  const palette = PALETTES[theme]
  return { page: theme === 'latte' ? palette.crust : palette.mantle, pane: palette.base, accent: palette[choice.value.accent], text: palette.text, dim: palette.overlay1 }
}
const modeOf = (theme: AppTheme) => (theme === 'truemain' ? 'both' : theme === 'latte' ? 'light' : 'dark')
const flavor = computed(() => (isFlavor(choice.value.theme) ? choice.value.theme : null))
</script>

<template>
  <section class="space-y-4 surface rounded-xl p-5">
    <header class="space-y-1">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-palette" class="size-5 text-primary" />
        <h2 class="text-sm font-semibold text-highlighted">{{ t('appearance.title') }}</h2>
      </div>
      <p class="text-xs text-muted">{{ t('appearance.description') }}</p>
    </header>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup" :aria-label="t('appearance.title')">
      <button
        v-for="theme in APP_THEMES"
        :key="theme"
        type="button"
        role="radio"
        :aria-checked="choice.theme === theme"
        class="group flex flex-col gap-2 rounded-xl p-2 text-left ring-1 transition-shadow"
        :class="choice.theme === theme ? 'ring-2 ring-primary' : 'ring-default hover:ring-accented'"
        @click="setTheme(theme)"
      >
        <!-- The page, a pane on it with a line of text, and the accent. -->
        <span class="flex aspect-[4/3] w-full flex-col justify-end gap-1.5 overflow-hidden rounded-lg p-2" :style="{ background: preview(theme).page }">
          <span class="flex flex-col gap-1 rounded-md p-1.5" :style="{ background: preview(theme).pane }">
            <span class="h-1.5 w-3/4 rounded-full" :style="{ background: preview(theme).text }" />
            <span class="h-1.5 w-1/2 rounded-full" :style="{ background: preview(theme).dim }" />
          </span>
          <span class="h-2 w-2/5 rounded-full" :style="{ background: preview(theme).accent }" />
        </span>
        <span class="px-0.5">
          <span class="block truncate text-xs font-semibold text-highlighted">{{ t(`appearance.theme.${theme}`) }}</span>
          <span class="block text-[11px] text-muted">{{ t(`appearance.mode.${modeOf(theme)}`) }}</span>
        </span>
      </button>
    </div>

    <div v-if="flavor" class="space-y-2">
      <p class="stat-label">{{ t('appearance.accent') }}</p>
      <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="t('appearance.accent')">
        <UTooltip v-for="accent in ACCENTS" :key="accent" :text="t(`appearance.accent.${accent}`)">
          <button
            type="button"
            role="radio"
            :aria-checked="choice.accent === accent"
            :aria-label="t(`appearance.accent.${accent}`)"
            class="size-7 rounded-full ring-offset-2 ring-offset-(--ui-bg-elevated) transition-transform hover:scale-110"
            :class="choice.accent === accent ? 'ring-2 ring-(--ui-text-highlighted)' : ''"
            :style="{ background: PALETTES[flavor][accent] }"
            @click="setAccent(accent)"
          />
        </UTooltip>
      </div>
    </div>

    <p class="flex items-start gap-2 text-xs text-muted">
      <UIcon name="i-lucide-app-window" class="mt-px size-4 shrink-0" />
      {{ t('appearance.icon') }}
    </p>
  </section>
</template>
