<script setup lang="ts">
import type { JevAnswerStatus } from '~/utils/jev-answers'
import type { JevCoverage, JevFailure } from '~/utils/jev-ask'
import { keyFailure } from '~/utils/jev-ask'

/**
 * How a Jev ask ended when that is not only its answer: no key, or one Jev
 * refused — Settings, never a retry, which would fail the same and loop —, a
 * failure told by its kind (the HTTP status where Jev answered one) with a
 * retry, or an answer that stands on part of its questions, with a click to
 * ask for the rest.
 */
const props = defineProps<{
  status: JevAnswerStatus
  failure: JevFailure | null
  partial: JevCoverage | null
}>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useT()

const toKey = computed(() => props.status === 'noKey' || (props.status === 'error' && keyFailure(props.failure)))
const cause = computed(() => {
  const failure = props.failure
  if (!failure) return undefined
  if (failure.kind === 'badKey') return t('jev.error.badKey', { status: failure.status ?? '' })
  if (failure.kind === 'noKey') return t('jev.card.noKey')
  if (failure.kind === 'http') return t('jev.error.http', { status: failure.status ?? '' })
  return t(`jev.error.${failure.kind}`)
})
</script>

<template>
  <UAlert
    v-if="toKey"
    color="warning"
    variant="subtle"
    icon="i-lucide-key-round"
    :title="failure?.kind === 'badKey' ? cause : t('jev.card.noKey')"
    :actions="[{ label: t('jev.card.openSettings'), to: '/settings', color: 'warning', variant: 'outline' }]"
    data-jev-key
  />
  <UAlert
    v-else-if="status === 'error'"
    color="error"
    variant="subtle"
    icon="i-lucide-circle-alert"
    :title="t('jev.card.error')"
    :description="cause"
    :actions="[{ label: t('common.retry'), color: 'error', variant: 'outline', onClick: () => emit('retry') }]"
    data-jev-error
  />
  <UAlert
    v-else-if="status === 'ready' && partial"
    color="warning"
    variant="subtle"
    icon="i-lucide-circle-dashed"
    :title="t('jev.partial.title', { answered: partial.answered, asked: partial.asked })"
    :description="[t('jev.partial.description'), cause].filter(Boolean).join(' ')"
    :actions="[{ label: t('jev.partial.retry'), color: 'warning', variant: 'outline', onClick: () => emit('retry') }]"
    data-jev-partial
  />
</template>
