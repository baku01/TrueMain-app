<script setup lang="ts">
import PlayerAvatar from '~/components/PlayerAvatar.vue'
import type { BuildOption } from '~/types/build'
import type { ProMatch } from '~/utils/blitz/pro'
import { proBuildOption, readProMatches } from '~/utils/blitz/pro'

/**
 * The champion's pros, in place of its true mains while Settings reads from
 * Blitz: the professional players who played
 * it on the lane lately (`utils/blitz/pro.ts`), most recent first — portrait,
 * team, the keystone and first item of their last game, and their record over
 * the games listed. A row shows that last game's build in the view.
 */
const props = defineProps<{
  championId: number
  position: string
  /** The build on screen, by key: the row whose last game it is reads as selected. */
  selectedKey?: string | null
}>()

const emit = defineEmits<{ select: [option: BuildOption, player: string] }>()

const { t } = useT()
const { runeTree, items } = useStaticData()
const { perk, item } = useBuildResolvers(runeTree, items)

const cache = useState<Record<string, ProMatch[]>>('champion-pros', () => ({}))
const failed = ref(false)
const key = computed(() => `${props.championId}:${props.position}`)

watch(key, async (next) => {
  failed.value = false
  if (cache.value[next]) return
  try {
    const read = await readProMatches(props.championId, props.position)
    cache.value = { ...cache.value, [next]: read }
  }
  catch {
    failed.value = true
  }
}, { immediate: true })

interface ProRow { name: string, team: string | null, portraitUrl: string | null, wins: number, losses: number, last: ProMatch, option: BuildOption }

const rows = computed<ProRow[] | null>(() => {
  const matches = cache.value[key.value]
  if (!matches) return null
  const byPlayer = new Map<number, ProRow>()
  // Newest first: a player's first game met is their last one.
  for (const match of matches) {
    const known = byPlayer.get(match.player.id)
    if (known) {
      if (match.win) known.wins += 1
      else known.losses += 1
      continue
    }
    byPlayer.set(match.player.id, {
      name: match.player.name,
      team: match.team?.tag ?? null,
      portraitUrl: match.player.portraitUrl,
      wins: match.win ? 1 : 0,
      losses: match.win ? 0 : 1,
      last: match,
      option: proBuildOption(match),
    })
  }
  return [...byPlayer.values()].slice(0, 12)
})
</script>

<template>
  <section class="flex flex-col gap-0.5">
    <h3 class="flex items-center gap-1.5 px-2 pb-1 stat-label">
      {{ t('pro.title') }}
      <UBadge :label="t('source.badge')" color="primary" variant="subtle" size="sm" class="ml-auto normal-case tracking-normal" />
    </h3>

    <div v-if="rows === null && !failed" class="space-y-1.5 px-2">
      <USkeleton v-for="row in 4" :key="row" class="h-11 w-full" />
    </div>
    <UEmpty v-else-if="failed || !rows?.length" size="sm" icon="i-lucide-trophy" :description="t('pro.none')" />

    <button
      v-for="row in rows ?? []"
      v-else
      :key="row.last.matchId"
      type="button"
      class="flex items-center gap-2.5 rounded-lg border-l-[3px] px-2 py-1.5 text-left transition-[filter,box-shadow] hover:brightness-125"
      :class="[row.last.win ? 'pro-win' : 'pro-loss', selectedKey === row.option.key ? 'ring-1 ring-inset ring-(--ui-text-dimmed)/50' : '']"
      :aria-label="`${row.name} · ${row.last.win ? t('pro.win') : t('pro.loss')}`"
      @click="emit('select', row.option, row.name)"
    >
      <PlayerAvatar :src="row.portraitUrl" :name="row.name" :size="32" class="rounded-md" />
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-semibold text-highlighted">{{ row.name }}<span v-if="row.team" class="ml-1 text-[11px] font-medium text-dimmed">{{ row.team }}</span></span>
        <span class="block truncate text-[11px] tabular-nums text-muted"><span class="font-semibold" :class="row.last.win ? 'text-primary' : 'text-error'">{{ row.last.win ? t('pro.win') : t('pro.loss') }}</span> · {{ t('pro.record', { wins: row.wins, losses: row.losses }) }} · {{ row.last.kills }}/{{ row.last.deaths }}/{{ row.last.assists }}</span>
      </span>
      <GameTooltipPerkIcon :perk="perk(row.option.keystoneId)" :width="22" :height="22" class="size-[22px] shrink-0 rounded-full" />
      <GameTooltipItemIcon :item="item(row.option.firstItemId || null)" :width="22" :height="22" class="size-[22px] shrink-0 rounded" />
    </button>
  </section>
</template>
