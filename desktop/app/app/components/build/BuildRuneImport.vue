<script setup lang="ts">
import { REMEMBER_BUILD } from '~/composables/useBuildOptions'
import type { KitRunePage } from '#shared/types/kit'

/**
 * The rune import button (#1678): a small icon in the corner of the runes,
 * there whenever the client is, out of the way of the page it imports. The
 * label lives in its tooltip; the toast says how it went.
 */
const props = defineProps<{
  page: KitRunePage
  champion: string
  /** Its label shown beside the icon, where the button stands in a header rather than a corner. */
  labeled?: boolean
  /**
   * Where the import is what the page offers (a guide's): the button shows
   * with the client closed too, greyed, this saying why in its tooltip.
   */
  closedHint?: string
  /** The button's own size and look, where it stands out of a corner (a guide's banner). */
  size?: 'xs' | 'sm' | 'md'
  color?: 'neutral' | 'primary'
}>()

const { t } = useT()
const { available, pending, done, importRunes } = useRuneImport()
/** Inside a build view, an import keeps the build as the player's previous one (`useBuildOptions`). */
const remember = inject(REMEMBER_BUILD, null)
function run() {
  remember?.()
  void importRunes(props.page, props.champion)
}
</script>

<template>
  <UTooltip v-if="available" :text="done ? t('build.imported') : t('build.importRunes')" :content="{ side: 'left' }">
    <UButton
      :size="size ?? 'xs'"
      :color="color ?? 'neutral'"
      :variant="labeled ? 'soft' : 'ghost'"
      :square="!labeled"
      :label="labeled ? (done ? t('build.imported') : t('build.importRunes')) : undefined"
      :icon="done ? 'i-lucide-check' : 'i-lucide-download'"
      :loading="pending"
      :aria-label="t('build.importRunes')"
      :class="labeled ? '' : 'text-dimmed hover:text-highlighted'"
      @click="run()"
    />
  </UTooltip>
  <!-- The client closed: the button greyed, wrapped so its tooltip still answers the pointer. -->
  <UTooltip v-else-if="closedHint" :text="closedHint" :content="{ side: 'left' }">
    <span class="inline-flex" tabindex="0">
      <UButton
        :size="size ?? 'xs'"
        :color="color ?? 'neutral'"
        :variant="labeled ? 'soft' : 'ghost'"
        :square="!labeled"
        :label="labeled ? t('build.importRunes') : undefined"
        icon="i-lucide-download"
        disabled
        :aria-label="t('build.importRunes')"
        :class="labeled ? '' : 'text-dimmed'"
      />
    </span>
  </UTooltip>
</template>
