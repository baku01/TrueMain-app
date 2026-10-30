<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Kit } from '#shared/types/kit'
import { KIT_NAME_MAX } from '~/utils/kit'

/**
 * One kit as the player reads it (#2185, #2205): its name, Edit, and
 * Duplicate / Rename / Delete (asks first) in a menu, over the kit drawn as a
 * build (`KitBuild`). Shared by the champion page and the My kits page. Every
 * kit is offered in champion select on its positions; there is nothing to
 * switch on.
 */
const props = defineProps<{ kit: Kit }>()
const emit = defineEmits<{ edit: [], duplicated: [id: string] }>()

const { t } = useT()
const { remove, duplicate, rename } = useKits()
const run = useKitAction()

const renaming = ref<string | null>(null)
const deleting = ref(false)

async function copy(): Promise<void> {
  await run(async () => {
    const made = await duplicate(props.kit.id)
    if (made) emit('duplicated', made.id)
  }, t('kit.error.duplicate'))
}

const menu = computed<DropdownMenuItem[][]>(() => [[
  { label: t('kit.action.duplicate'), icon: 'i-lucide-copy', onSelect: copy },
  { label: t('kit.action.rename'), icon: 'i-lucide-pencil-line', onSelect: () => (renaming.value = props.kit.name) },
  { label: t('kit.action.delete'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => (deleting.value = true) },
]])

async function confirmRename() {
  const name = renaming.value?.trim()
  if (!name) return
  await run(() => rename(props.kit.id, name), t('kit.error.rename'))
  renaming.value = null
}

async function confirmDelete() {
  await run(() => remove(props.kit.id), t('kit.error.delete'))
  deleting.value = false
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <h2 class="min-w-0 truncate text-base font-semibold text-highlighted">{{ kit.name }}</h2>
      <span class="flex-1" />
      <UButton :label="t('kit.action.edit')" icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" @click="emit('edit')" />
      <UDropdownMenu :items="menu" :content="{ align: 'end' }">
        <UButton icon="i-lucide-ellipsis" size="xs" color="neutral" variant="ghost" :aria-label="t('kit.action.more')" />
      </UDropdownMenu>
    </div>
    <KitBuild :kit="kit" />

    <UModal :open="renaming !== null" :title="t('kit.rename.title')" @update:open="renaming = $event ? renaming : null">
      <template #body>
        <form class="flex items-center gap-2" @submit.prevent="confirmRename">
          <UInput v-if="renaming !== null" v-model="renaming" :maxlength="KIT_NAME_MAX" class="flex-1" :aria-label="t('kit.field.name')" />
          <UButton type="submit" :label="t('kit.action.rename')" :disabled="!renaming?.trim()" />
        </form>
      </template>
    </UModal>

    <UModal :open="deleting" :title="t('kit.delete.title')" :description="t('kit.delete.description', { name: kit.name })" @update:open="deleting = $event">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton :label="t('kit.delete.keep')" color="neutral" variant="ghost" @click="deleting = false" />
          <UButton :label="t('kit.action.delete')" color="error" @click="confirmDelete" />
        </div>
      </template>
    </UModal>
  </div>
</template>
