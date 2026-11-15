<script setup lang="ts">
import { REMEMBER_BUILD } from '~/composables/useBuildOptions'
import type { ItemSetBlocks, ItemSetNamedBlocks, ItemSetSubject } from '~/composables/useItemSetImport'

/**
 * The item set import button (#1908): the rune button's twin, in the corner of
 * the build's items, there whenever the client is. The label lives in its
 * tooltip; the toast says how it went.
 */
const props = defineProps<{
  /** A build view's build, or one already laid out in the set's blocks. */
  subject: ItemSetSubject | ItemSetBlocks | ItemSetNamedBlocks
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
  /** Solid where the button stands over art (a guide's banner); soft beside its label, ghost in a corner otherwise. */
  variant?: 'soft' | 'solid'
}>()

const { t } = useT()
const { available, pending, done, importItemSet } = useItemSetImport()
/** Inside a build view, an import keeps the build as the player's previous one (`useBuildOptions`). */
const remember = inject(REMEMBER_BUILD, null)
function run() {
  remember?.()
  void importItemSet(props.subject)
}
</script>

<template>
  <UTooltip v-if="available" :text="done ? t('build.imported') : t('build.importItems')" :content="{ side: 'left' }">
    <UButton
      :size="size ?? 'xs'"
      :color="color ?? 'neutral'"
      :variant="variant ?? (labeled ? 'soft' : 'ghost')"
      :square="!labeled"
      :label="labeled ? (done ? t('build.imported') : t('build.importItems')) : undefined"
      :icon="done ? 'i-lucide-check' : 'i-lucide-download'"
      :loading="pending"
      :aria-label="t('build.importItems')"
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
        :variant="variant ?? (labeled ? 'soft' : 'ghost')"
        :square="!labeled"
        :label="labeled ? t('build.importItems') : undefined"
        icon="i-lucide-download"
        disabled
        :aria-label="t('build.importItems')"
        :class="labeled ? '' : 'text-dimmed'"
      />
    </span>
  </UTooltip>
</template>
