<script setup lang="ts">
import type { CompositionBuildRequest } from '~/types/build'
import type { DraftSelection } from '~/composables/useDraftAutoImport'
import type { useJevBases } from '~/composables/useJevBases'
import type { useJevBuild } from '~/composables/useJevBuild'
import { jevImportName, jevImportTitles, jevImportSelection } from '~/utils/jev-bases'

/**
 * The Builds tab with Jev: the family Jev ranks within (`JevBaseSelect`),
 * then its answer — Jev's build beside that family's most played
 * (`JevBuildBody`) — once the player clicked; until then, what a click does.
 * The answer is told up as the draft's automatic import (`selection`): Jev's
 * build and the base's most played, named after the base.
 */
const props = defineProps<{
  subject: { championId: number, request: CompositionBuildRequest } | null
  jev: ReturnType<typeof useJevBuild>
  bases: ReturnType<typeof useJevBases>
}>()
const emit = defineEmits<{ selection: [value: DraftSelection] }>()
const { t } = useT()
const { nameOf } = useChampionStatics()
const { tag } = useJevBaseLabels()
const { status, error, ranked, needs, enemies, jevBuild, standardBuild, answered } = props.jev
const { offered, selected, pending } = props.bases

const selection = computed(() => {
  const subject = props.subject
  if (status.value !== 'ready' || !subject || !answered.value) return null
  const name = jevImportName(nameOf(subject.championId), enemies.value.find(enemy => enemy.opponent)?.name ?? null)
  return jevImportSelection(subject.championId, answered.value, ranked.value, jevBuild.value, standardBuild.value, jevImportTitles(name, tag(answered.value)))
})
watch(() => JSON.stringify(selection.value), () => selection.value && emit('selection', selection.value), { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-4">
    <JevBaseSelect v-if="subject" v-model="selected" :offered="offered" :pending="pending" :answered="status === 'ready' ? answered : null" />
    <UAlert v-if="status === 'noKey'" color="warning" variant="subtle" icon="i-lucide-key-round" :title="t('jev.card.noKey')" :actions="[{ label: t('jev.card.openSettings'), to: '/settings', color: 'warning', variant: 'outline' }]" />
    <UAlert v-else-if="status === 'noOptions'" color="neutral" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.card.noOptions')" />
    <UAlert v-else-if="status === 'error'" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.card.error')" :description="error ?? undefined" />
    <JevBuildBody
      v-if="status === 'ready' && subject"
      :champion-id="subject.championId"
      :position="subject.request.position"
      :ranked="ranked"
      :needs="needs"
      :enemies="enemies"
      :jev-build="jevBuild"
      :standard-build="standardBuild"
      :base="answered"
    />
    <div v-else-if="status === 'loading'" class="flex flex-col gap-3">
      <USkeleton class="h-40 rounded-2xl" />
      <USkeleton class="h-64 rounded-2xl" />
    </div>
    <div v-else-if="status === 'idle'" class="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
      <UIcon name="i-tabler-chess-knight" class="size-6 text-dimmed" />
      <p class="max-w-md text-sm text-muted">{{ t('jev.coach.idleBuild') }}</p>
    </div>
  </div>
</template>
