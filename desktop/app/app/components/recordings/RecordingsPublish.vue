<script setup lang="ts">
import type { Clip } from '~/types/recordings'
import { clipPublishText } from '~/utils/clip-publish'

const { t } = useT()

/**
 * "Publish on YouTube" (#1815): YouTube's own upload page does the upload, in
 * the player's browser and under their channel. The dialog walks the four
 * steps — open the page, drag the clip onto it, paste the prepared text, give
 * the video's link back — and keeps nothing until that link is saved. The
 * shell keeps a link only once YouTube confirms it is a video anyone with the
 * link can watch, titled as the clip: so the title is not editable here (the
 * clip is renamed instead). Then the file can leave this PC, the clip playing
 * from YouTube (#2005).
 */
const props = defineProps<{ clip: Clip }>()
const open = defineModel<boolean>('open', { default: false })

const { fileSrc } = useRecordings()
const { nameOf, aliasOf } = useChampionStatics()
const { openUpload, setYoutubeUrl } = useClipPublish()

const title = ref('')
const description = ref('')
const tags = ref('')
const link = ref('')
const saving = ref(false)
const linkError = ref<string | null>(null)
const freeing = ref(false)

/** Prepared again on each opening, from the clip as it is now (a rename included). */
watch(open, (opened) => {
  if (!opened) return
  const championId = props.clip.championId
  const champion = championId ? { name: nameOf(championId), alias: aliasOf(championId) } : null
  const text = clipPublishText(props.clip, champion)
  title.value = text.title
  description.value = text.description
  tags.value = text.tags
  link.value = props.clip.youtubeUrl ?? ''
  linkError.value = null
}, { immediate: true })
watch(link, () => (linkError.value = null))

const thumbnailFailed = ref(false)
const thumbnail = computed(() => (thumbnailFailed.value ? null : fileSrc(props.clip.thumbnailPath)))
watch(() => props.clip.thumbnailPath, () => (thumbnailFailed.value = false))

async function saveLink() {
  saving.value = true
  linkError.value = await setYoutubeUrl(props.clip.id, link.value)
  saving.value = false
}

async function forgetLink() {
  linkError.value = await setYoutubeUrl(props.clip.id, '')
  if (!linkError.value) link.value = ''
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('rec.publish.action')"
    :description="t('rec.publish.description')"
    :ui="{ content: 'max-w-xl', footer: 'justify-end' }"
  >
    <template #body>
      <ol class="flex flex-col gap-5">
        <li class="flex flex-col gap-2">
          <p class="step">{{ t('rec.publish.step1') }}</p>
          <UButton icon="i-lucide-youtube" :label="t('rec.publish.openYoutube')" class="self-start" @click="openUpload" />
        </li>

        <li class="flex flex-col gap-2">
          <p class="step">{{ t('rec.publish.step2') }}</p>
          <RecordingsPublishClipCard :clip="clip" :thumbnail="thumbnail" @thumbnail-error="thumbnailFailed = true" />
        </li>

        <li class="flex flex-col gap-2">
          <p class="step">{{ t('rec.publish.step3') }}</p>
          <RecordingsPublishDetails v-model:description="description" v-model:tags="tags" :title="title" />
        </li>

        <li class="flex flex-col gap-2">
          <p class="step">{{ t('rec.publish.step4') }}</p>
          <RecordingsPublishLink
            v-model:link="link"
            :clip="clip"
            :saving="saving"
            :error="linkError"
            @save="saveLink"
            @forget="forgetLink"
            @free="freeing = true"
          />
        </li>
      </ol>
    </template>

    <template #footer>
      <UButton :label="t('rec.close')" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </UModal>

  <RecordingsDeleteVideo v-model:open="freeing" :clip="clip" @deleted="open = false" />
</template>

<style scoped>
ol {
  counter-reset: step;
}

.step {
  counter-increment: step;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ui-text-highlighted);
}

.step::before {
  content: counter(step) ". ";
  color: var(--ui-primary);
}
</style>
