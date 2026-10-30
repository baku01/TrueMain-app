<script setup lang="ts">
import type { Kit } from '#shared/types/kit'
import { positionLabel } from '#common/utils/positions'
import { cloneKit, freeName, kitFromBuild } from '~/utils/kit'
import { defaultRunePage } from '~/utils/kit-runes'

/**
 * "My kits" on the app's champion page (#2185): the player's kits offered on
 * the champion and lane on the left, as the build view lists builds; on the
 * right the kit picked (`KitDetail`), or the editor. A new kit starts from
 * TrueMain's build on the lane — its starter, boots, core path, rune page and
 * spells — so the player swaps rather than fills. Every kit is offered in
 * champion select on its positions, and is also on the My kits page (#2205).
 */
const props = defineProps<{ championId: number, position: string }>()

const { t } = useT()
const { kitsFor, save } = useKits()
const { response, pending: buildsPending } = useChampionBuilds(toRef(props, 'championId'), toRef(props, 'position'))
const { runeTree } = useStaticData()
const run = useKitAction()

const kits = computed(() => kitsFor(props.championId, props.position))

const selected = ref<string | null>(null)
/** The kit in the editor: a new one, or a copy of the one picked. */
const editing = ref<Kit | null>(null)
const saving = ref(false)

watch(() => `${props.championId}:${props.position}`, () => {
  editing.value = null
  selected.value = kits.value[0]?.id ?? null
}, { immediate: true })
watch(kits, (list) => {
  if (!list.some(kit => kit.id === selected.value)) selected.value = list[0]?.id ?? null
})

const shown = computed(() => kits.value.find(kit => kit.id === selected.value) ?? null)
const lane = computed(() => positionLabel(props.position, { short: true }))
const canCreate = computed(() => runeTree.value !== null && !buildsPending.value)

function create() {
  const core = response.value?.builds[0]?.core ?? null
  const name = freeName(lane.value ? t('kit.new.defaultName', { lanes: lane.value }) : t('kit.new.defaultNameBare'), kits.value.map(kit => kit.name))
  const kit = kitFromBuild({ championId: props.championId, positions: [props.position], name }, core, runeTree.value ? defaultRunePage(runeTree.value) : null)
  if (kit) editing.value = kit
}

async function saveEdited(kit: Kit) {
  saving.value = true
  const saved = await run(() => save(kit), t('kit.error.save'))
  if (saved) {
    // Taken off this lane, it goes back to the lane's list as it is.
    selected.value = kit.positions.includes(props.position) ? kit.id : selected.value
    editing.value = null
  }
  saving.value = false
}

</script>

<template>
  <div class="surface grid h-full min-h-0 grid-cols-[18rem_minmax(0,1fr)] overflow-hidden rounded-xl">
    <aside class="flex min-h-0 flex-col border-r border-default bg-muted/50">
      <div class="flex items-center justify-between gap-2 border-b border-default px-3 py-2.5">
        <span class="text-sm font-semibold text-highlighted">{{ t('kit.list.label') }}{{ lane ? ` · ${lane}` : '' }}</span>
        <UButton :label="t('kit.new.button')" icon="i-lucide-plus" size="xs" color="neutral" variant="soft" :disabled="!canCreate || editing !== null" @click="create" />
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-2">
        <KitList v-if="kits.length" v-model="selected" :kits="kits" />
        <p v-else class="px-2 py-1 text-xs text-dimmed">{{ t('kit.panel.none') }}</p>
      </div>
    </aside>

    <div class="min-h-0 overflow-y-auto p-3">
      <KitEditor v-if="editing" :kit="editing" :saving="saving" @save="saveEdited" @cancel="editing = null" />

      <KitDetail
        v-else-if="shown"
        :kit="shown"
        @edit="editing = cloneKit(shown)"
        @duplicated="id => (selected = id)"
      />

      <div v-else class="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <UIcon name="i-lucide-swords" class="size-6 text-dimmed" />
        <p class="text-sm text-muted">{{ t('kit.panel.empty') }}</p>
        <p class="max-w-xs text-xs text-dimmed">{{ t('kit.empty.hint') }}</p>
      </div>
    </div>
  </div>
</template>
