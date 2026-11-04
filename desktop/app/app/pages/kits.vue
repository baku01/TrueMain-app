<script setup lang="ts">
import type { Kit } from '#shared/types/kit'
import { cloneKit } from '~/utils/kit'

/**
 * My kits (#2205): every kit of the player's, grouped by champion, read and
 * edited as on the champion page (`KitDetail`, `KitEditor`), and new ones made
 * here for any champion and one or several positions (`KitNew`). Each is
 * offered in champion select on its positions, beside TrueMain's builds.
 */
const { t } = useT()
const { store, save } = useKits()
const { nameOf, portraitOf } = useChampionStatics()
const run = useKitAction()

const groups = computed(() => {
  const byChampion = new Map<number, Kit[]>()
  for (const kit of store.value.kits) byChampion.set(kit.championId, [...(byChampion.get(kit.championId) ?? []), kit])
  return [...byChampion.entries()]
    .map(([championId, kits]) => ({ championId, name: nameOf(championId) || t('kit.page.champion', { id: championId }), kits: [...kits].sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const selected = ref<string | null>(null)
const editing = ref<Kit | null>(null)
const saving = ref(false)
const creating = ref(false)

watch(groups, (list) => {
  const kits = list.flatMap(group => group.kits)
  if (!kits.some(kit => kit.id === selected.value)) selected.value = kits[0]?.id ?? null
}, { immediate: true })

const shown = computed(() => store.value.kits.find(kit => kit.id === selected.value) ?? null)

async function saveEdited(kit: Kit) {
  saving.value = true
  if (await run(() => save(kit), t('kit.error.save'))) {
    selected.value = kit.id
    editing.value = null
  }
  saving.value = false
}

</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-5 p-6">
    <PageHeader :title="t('kit.page.title')" :description="t('kit.page.description')">
      <template #actions>
        <UButton :label="t('kit.new.button')" icon="i-lucide-plus" size="sm" :disabled="editing !== null" @click="creating = true" />
      </template>
    </PageHeader>

    <div v-if="groups.length || editing" class="surface grid min-h-0 flex-1 grid-cols-[18rem_minmax(0,1fr)] overflow-hidden rounded-xl">
      <aside class="min-h-0 overflow-y-auto border-r border-default bg-muted/50 p-2">
        <section v-for="group in groups" :key="group.championId" class="mb-3 last:mb-0">
          <h2 class="flex items-center gap-2 px-2.5 py-1.5">
            <img :src="portraitOf(group.championId) ?? undefined" :alt="group.name" width="20" height="20" class="size-5 rounded img-skeleton">
            <span class="stat-label">{{ group.name }}</span>
          </h2>
          <KitList v-model="selected" :kits="group.kits" show-positions />
        </section>
      </aside>

      <div class="min-h-0 overflow-y-auto p-3">
        <KitEditor v-if="editing" :kit="editing" :saving="saving" @save="saveEdited" @cancel="editing = null" />
        <KitDetail
          v-else-if="shown"
          :kit="shown"
          @edit="editing = cloneKit(shown)"
          @duplicated="id => (selected = id)"
        />
      </div>
    </div>

    <EmptyState v-else icon="i-ph-backpack-light" :title="t('kit.page.empty')" :description="t('kit.empty.hint')">
      <UButton :label="t('kit.new.button')" icon="i-lucide-plus" @click="creating = true" />
    </EmptyState>

    <KitNew v-model:open="creating" @create="kit => (editing = kit)" />
  </div>
</template>
