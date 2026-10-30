<script setup lang="ts">
import { getActiveLocale } from '#common/utils/i18n'
import type { PatchSummary } from '~/utils/patch-notes'

/**
 * Riot's patch notes, read in the app: the newest patch opens by itself, any
 * earlier one is a pick away, and the list keeps itself current
 * (`usePatchNotes`). The picked patch lives in the query (`?v=26.21`), so a
 * link can land on it; without one the page follows the newest.
 */
const { t } = useT()
const { list, listStatus, updatedAt, noteStatus, noteOf, loadList, loadNote, keepFresh, openOnSite } = usePatchNotes()
const route = useRoute()
const router = useRouter()

keepFresh()

const picked = computed(() => (typeof route.query.v === 'string' ? route.query.v : null))
const selected = computed<PatchSummary | null>(() => list.value.find(patch => patch.version === picked.value) ?? list.value[0] ?? null)
const isLatest = computed(() => selected.value?.version === list.value[0]?.version)
const note = computed(() => noteOf(selected.value))

watch(selected, (patch) => {
  if (patch) void loadNote(patch)
}, { immediate: true })

function formatDate(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(getActiveLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

const options = computed(() => list.value.map(patch => ({
  label: t('patchnotes.patch', { version: patch.version }),
  description: formatDate(patch.publishedAt),
  value: patch.version,
})))

const choice = computed({
  get: () => selected.value?.version,
  set: (version) => {
    const latest = version === list.value[0]?.version
    void router.replace({ query: latest || !version ? {} : { v: version } })
  },
})

const refreshing = computed(() => listStatus.value === 'loading')
const updatedLabel = computed(() => (updatedAt.value ? new Intl.DateTimeFormat(getActiveLocale(), { hour: '2-digit', minute: '2-digit' }).format(updatedAt.value) : ''))
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5">
    <div class="flex shrink-0 flex-wrap items-center gap-3">
      <UIcon name="i-ph-scroll-light" class="size-6 text-primary" />
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ t('patchnotes.title') }}</h1>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <span v-if="updatedLabel" class="text-xs text-muted">{{ t('patchnotes.updated', { time: updatedLabel }) }}</span>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          size="sm"
          :loading="refreshing"
          :aria-label="t('patchnotes.refresh')"
          @click="loadList(true)"
        />
        <USelectMenu
          v-if="options.length"
          v-model="choice"
          :items="options"
          value-key="value"
          :search-input="{ placeholder: t('patchnotes.pick') }"
          class="w-56"
          :aria-label="t('patchnotes.pick')"
        />
      </div>
    </div>

    <div v-if="listStatus === 'error'" class="surface shrink-0 rounded-xl p-8 text-center">
      <p class="text-sm text-muted">{{ t('patchnotes.error') }}</p>
      <UButton class="mt-3" :label="t('patchnotes.retry')" icon="i-lucide-refresh-cw" size="sm" @click="loadList(true)" />
    </div>

    <div v-else-if="!selected" aria-busy="true" class="space-y-3">
      <USkeleton class="h-40 w-full" />
      <USkeleton class="h-24 w-full" />
    </div>

    <template v-else>
      <header class="relative shrink-0 overflow-hidden rounded-xl border border-default bg-default">
        <!-- The banner sits on the right, whole in height and fading into the card on its left, so the art is seen and the text reads on a plain ground. -->
        <img
          v-if="selected.imageUrl"
          :src="selected.imageUrl"
          alt=""
          class="absolute inset-y-0 right-0 h-full w-3/5 object-cover object-[75%_30%] [mask-image:linear-gradient(to_right,transparent,black_45%)]"
        >
        <div class="relative flex min-h-52 flex-wrap items-end gap-4 p-6">
          <div class="min-w-0 max-w-[44%] flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge :label="selected.version" color="primary" variant="subtle" size="sm" />
              <UBadge v-if="isLatest" :label="t('patchnotes.latest')" color="neutral" variant="subtle" size="sm" />
              <span class="text-xs text-muted">{{ formatDate(selected.publishedAt) }}</span>
            </div>
            <h2 class="mt-2 text-xl font-semibold tracking-tight text-highlighted">{{ selected.title }}</h2>
            <p v-if="selected.description" class="mt-1 max-w-3xl text-sm text-muted">{{ selected.description }}</p>
          </div>
          <UButton :label="t('patchnotes.openOnSite')" icon="i-lucide-external-link" color="neutral" variant="soft" size="sm" @click="openOnSite(selected)" />
        </div>
      </header>

      <div v-if="noteStatus === 'error' && !note" class="surface shrink-0 rounded-xl p-8 text-center">
        <p class="text-sm text-muted">{{ t('patchnotes.noteError') }}</p>
        <UButton class="mt-3" :label="t('patchnotes.retry')" icon="i-lucide-refresh-cw" size="sm" @click="loadNote(selected)" />
      </div>
      <div v-else-if="!note" aria-busy="true" class="grid grid-cols-2 gap-3">
        <USkeleton v-for="card in 6" :key="card" class="h-32 w-full" />
      </div>
      <PatchnotesPatchNoteView v-else :note="note" />
    </template>
  </div>
</template>
