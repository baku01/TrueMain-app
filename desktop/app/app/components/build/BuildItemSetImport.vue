<script setup lang="ts">
import { REMEMBER_BUILD } from '~/composables/useBuildOptions'
import type { ItemSetBlocks, ItemSetSubject } from '~/composables/useItemSetImport'

/**
 * The item set import button (#1908): the rune button's twin, in the corner of
 * the build's items, there whenever the client is. The label lives in its
 * tooltip; the toast says how it went.
 */
const props = defineProps<{
  /** A build view's build, or one already laid out in the set's blocks. */
  subject: ItemSetSubject | ItemSetBlocks
  /** Its label shown beside the icon, where the button stands in a header rather than a corner. */
  labeled?: boolean
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
      size="xs"
      color="neutral"
      :variant="labeled ? 'soft' : 'ghost'"
      :square="!labeled"
      :label="labeled ? (done ? t('build.imported') : t('build.importItems')) : undefined"
      :icon="done ? 'i-lucide-check' : 'i-lucide-download'"
      :loading="pending"
      :aria-label="t('build.importItems')"
      :class="labeled ? '' : 'text-dimmed hover:text-highlighted'"
      @click="run()"
    />
  </UTooltip>
</template>
