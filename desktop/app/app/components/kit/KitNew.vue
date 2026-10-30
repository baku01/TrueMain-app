<script setup lang="ts">
import type { Kit } from '#shared/types/kit'
import type { ChampionPosition } from '#common/utils/positions'
import { positionLabel } from '#common/utils/positions'
import { freeName, kitFromBuild } from '~/utils/kit'
import { defaultRunePage } from '~/utils/kit-runes'

/**
 * A new kit from the My kits page (#2205): the champion (the site's
 * `ChampionPicker`) and the positions it is offered on (the filters' position
 * strip, several at once), then "Create" starts it from TrueMain's build on the
 * first of them — starter, boots, core path, rune page and spells — for the
 * editor to take over.
 */
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ create: [kit: Kit] }>()

const { t } = useT()
const championsById = useStaticChampionsById()
const champions = computed(() => [...championsById.value.values()])
const { store } = useKits()
const { runeTree } = useStaticData()

const championId = ref<number | null>(null)
const positions = ref<ChampionPosition[]>([])
watch(open, (value) => {
  if (!value) return
  championId.value = null
  positions.value = []
})

const firstPosition = computed(() => positions.value[0] ?? null)
const { response, pending } = useChampionBuilds(championId, firstPosition)
const ready = computed(() => championId.value !== null && positions.value.length > 0 && runeTree.value !== null && !pending.value)

function create() {
  const id = championId.value
  if (!ready.value || id === null) return
  const lanes = positions.value.map(position => positionLabel(position, { short: true })).join(' · ')
  const taken = store.value.kits.filter(kit => kit.championId === id).map(kit => kit.name)
  const kit = kitFromBuild(
    { championId: id, positions: [...positions.value], name: freeName(t('kit.new.defaultName', { lanes }), taken) },
    response.value?.builds[0]?.core ?? null,
    runeTree.value ? defaultRunePage(runeTree.value) : null,
  )
  if (!kit) return
  emit('create', kit)
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" :title="t('kit.new.button')" :description="t('kit.new.description')">
    <template #body>
      <div class="space-y-4">
        <UFormField :label="t('kit.new.champion')">
          <ChampionPicker v-model:champion-id="championId" :champions="champions" :placeholder="t('kit.new.searchChampion')" trigger-class="w-64" :clearable="false" />
        </UFormField>
        <UFormField :label="t('kit.field.positions')" :description="t('kit.new.positionsHint')">
          <RolePicker v-model:positions="positions" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton :label="t('kit.action.cancel')" color="neutral" variant="ghost" @click="open = false" />
        <UButton :label="t('kit.new.create')" icon="i-lucide-plus" :disabled="!ready" :loading="pending && championId !== null && positions.length > 0" @click="create" />
      </div>
    </template>
  </UModal>
</template>
