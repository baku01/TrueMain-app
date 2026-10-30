<script setup lang="ts">
import type { Clip } from '~/types/recordings'
import { formatBytes } from '~/utils/recording-library'

const { t } = useT()

/**
 * The publish dialog's last step: the video's link, given back once it is up and
 * checked with YouTube — then the clip can leave this PC and play from there.
 */
defineProps<{
  clip: Clip
  saving: boolean
  error: string | null
}>()
const link = defineModel<string>('link', { required: true })

const emit = defineEmits<{ save: [], forget: [], free: [] }>()

const { openVideo } = useClipPublish()
</script>

<template>
  <template v-if="clip.youtubeUrl">
    <div class="flex items-center gap-2 text-sm">
      <UIcon name="i-lucide-circle-check" class="size-4 shrink-0 text-success" />
      <span class="min-w-0 flex-1 truncate text-default">{{ clip.youtubeUrl }}</span>
      <UButton icon="i-lucide-external-link" :label="t('rec.publish.watch')" color="neutral" variant="outline" size="xs" @click="openVideo(clip.id)" />
      <UButton
        v-if="clip.videoOnDisk"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="t('rec.publish.forget')"
        :title="t('rec.publish.forget')"
        @click="emit('forget')"
      />
    </div>
    <p v-if="error" class="text-xs text-error" role="alert">{{ error }}</p>
    <div v-if="clip.videoOnDisk" class="flex items-center gap-3">
      <UButton
        icon="i-lucide-hard-drive-download"
        :label="t('rec.publish.removeSized', { size: formatBytes(clip.sizeBytes) })"
        color="neutral"
        variant="soft"
        size="sm"
        @click="emit('free')"
      />
      <span class="text-xs text-muted">{{ t('rec.publish.staysNote') }}</span>
    </div>
  </template>
  <form v-else class="flex flex-col gap-1.5" @submit.prevent="emit('save')">
    <div class="flex gap-2">
      <UInput
        v-model="link"
        placeholder="https://youtu.be/…"
        class="flex-1"
        :aria-label="t('rec.publish.linkAria')"
        :color="error ? 'error' : undefined"
        :highlight="Boolean(error)"
      />
      <UButton type="submit" :label="t('rec.publish.checkSave')" color="neutral" variant="outline" :loading="saving" :disabled="!link.trim()" />
    </div>
    <p v-if="error" class="text-xs text-error" role="alert">{{ error }}</p>
    <p v-else class="text-xs text-muted">{{ t('rec.publish.checkNote') }}</p>
  </form>
</template>
