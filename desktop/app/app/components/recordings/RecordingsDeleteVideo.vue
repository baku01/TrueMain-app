<script setup lang="ts">
import type { Clip } from '~/types/recordings'
import { formatBytes } from '~/utils/recording-library'

const { t } = useT()

/**
 * "Remove from this PC" for a clip published on YouTube (#2005): its video
 * file goes, the clip stays in the library — thumbnail, title, K/D/A — and
 * plays from YouTube. Asked once, since the file does not come back.
 */
const props = defineProps<{ clip: Pick<Clip, 'id' | 'title' | 'sizeBytes'> }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ deleted: [] }>()

const { deleteVideo } = useClipPublish()

async function confirm() {
  if (await deleteVideo(props.clip.id)) emit('deleted')
}
</script>

<template>
  <RecordingsConfirm
    v-model:open="open"
    :title="t('rec.deleteVideo.title')"
    :description="t('rec.deleteVideo.description', { size: formatBytes(clip.sizeBytes), title: clip.title })"
    :confirm-label="t('rec.removeFromPc')"
    @confirm="confirm"
  />
</template>
