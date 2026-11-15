<script setup lang="ts">
/**
 * An author's notes on a part of their build, read where the part is.
 * MOBAFire keeps them in an icon's tooltip, a hover away; here they sit under
 * what they explain, a long one cut at three lines with a click to read it
 * all.
 */
const props = defineProps<{ notes: string | null }>()
const { t } = useT()
const open = ref(false)
/** Long enough to be cut: past three lines' worth of words, or of line breaks. */
const long = computed(() => (props.notes?.length ?? 0) > 220 || (props.notes?.split('\n').length ?? 0) > 3)
watch(() => props.notes, () => (open.value = false))
</script>

<template>
  <div v-if="notes" class="guide-text flex gap-2.5 rounded-lg bg-primary/6 px-3 py-2.5 text-xs leading-relaxed text-toned ring-1 ring-primary/12">
    <UIcon name="i-lucide-notebook-pen" class="mt-0.5 size-3.5 shrink-0 text-primary" :aria-label="t('guides.notes')" />
    <div class="min-w-0 flex-1">
      <p class="whitespace-pre-line break-words" :class="long && !open && 'line-clamp-3'">{{ notes }}</p>
      <button v-if="long" type="button" class="mt-1 text-[11px] font-semibold text-primary hover:underline" @click="open = !open">
        {{ open ? t('guides.readLess') : t('guides.readMore') }}
      </button>
    </div>
  </div>
</template>
