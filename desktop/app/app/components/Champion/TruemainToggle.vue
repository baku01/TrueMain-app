<script setup lang="ts">
/**
 * The app follows no true mains: the shared filter bar's "Truemains" switch
 * (`web/layers/common`, same name) is replaced by nothing here, and the lists
 * keep the slice the source answers by default.
 */
defineProps<{ modelValue?: boolean }>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <span class="hidden" />
</template>
