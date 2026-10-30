<script setup lang="ts">
import { YOUTUBE_DESCRIPTION_MAX } from '~/utils/clip-publish'

const { t } = useT()

/**
 * The text the publish dialog prepares for YouTube's form, each field with its
 * copy button. The title is read-only: TrueMain recognises the video by it.
 */
defineProps<{ title: string }>()
const description = defineModel<string>('description', { required: true })
const tags = defineModel<string>('tags', { required: true })

const { copy } = useClipPublish()
</script>

<template>
  <UFormField :label="t('rec.publish.title')" :help="t('rec.publish.titleHelp')">
    <UInput :model-value="title" readonly class="w-full">
      <template #trailing>
        <UButton icon="i-lucide-copy" color="neutral" variant="link" size="xs" :aria-label="t('rec.publish.copyTitle')" @click="copy(title, 'title')" />
      </template>
    </UInput>
  </UFormField>
  <UFormField :label="t('rec.publish.descriptionLabel')">
    <div class="relative">
      <UTextarea v-model="description" :maxlength="YOUTUBE_DESCRIPTION_MAX" :rows="4" autoresize class="w-full" />
      <UButton
        icon="i-lucide-copy"
        color="neutral"
        variant="link"
        size="xs"
        class="absolute right-1.5 top-1.5"
        :aria-label="t('rec.publish.copyDescription')"
        @click="copy(description, 'description')"
      />
    </div>
  </UFormField>
  <UFormField :label="t('rec.publish.tags')" :help="t('rec.publish.tagsHelp')">
    <UInput v-model="tags" class="w-full">
      <template #trailing>
        <UButton icon="i-lucide-copy" color="neutral" variant="link" size="xs" :aria-label="t('rec.publish.copyTags')" @click="copy(tags, 'tags')" />
      </template>
    </UInput>
  </UFormField>
</template>
