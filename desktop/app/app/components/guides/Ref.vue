<script setup lang="ts">
import type { GuideRef } from '~/utils/guide-prose'
import { englishChampion, championOfWord, skinWord } from '~/utils/guide-art'
import { idOf, nameKey } from '~/utils/guide-entities'
import { abilityParts, localPart } from '~/utils/guide-terms'

/**
 * An author's inline reference to the game — an item, a rune, a summoner
 * spell, a champion or an ability, in the middle of a sentence — drawn as the
 * app draws it everywhere: its icon with its tooltip, and, where the author
 * wrote the name beside the picture, the name in the player's language. The
 * site's picture and English name stay while the app's data is read, and for
 * anything the index does not know.
 */
const props = defineProps<{ reference: GuideRef }>()

const index = useGuideIndex()
const { items, summoners, runeTree, championStatic, loadChampion } = useStaticData()
const { patch, aliasOf, nameOf, portraitOf } = useChampionStatics()

const SIZE = 22

/** The thing's id in the game, by its English name or the word of the site's picture. */
const id = computed(() => {
  const known = index.value
  const { kind, name, image } = props.reference
  if (!known) return null
  if (kind === 'item') return idOf(known.items, name, image)
  if (kind === 'spell') return idOf(known.spells, name, image)
  if (kind === 'rune') return idOf(known.runes, name, image) ?? idOf(known.styles, name, image)
  if (kind === 'champion') return idOf(known.champions, name, image)
  return null
})

/** An ability's champion, from the site's picture of it (`/images/ability/briar-head-rush.png`). */
const abilityChampion = computed(() => {
  if (props.reference.kind !== 'ability' || !index.value) return null
  const word = props.reference.image?.match(/\/images\/ability\/([a-z0-9-]+)\.(?:png|jpe?g|webp)$/)?.[1] ?? skinWord(props.reference.image)
  return word ? championOfWord(word, index.value.champions) : null
})

/**
 * The ability's key (`Q`, `P` for the passive), from its English name among
 * the champion's — and, for an ability of two forms named as one (`Blood
 * Frenzy / Snack Attack`), which of its names the author wrote.
 */
const abilityKey = ref<{ key: string, part?: { at: number, of: number } } | null>(null)
watch([abilityChampion, patch], async ([champion, version]) => {
  abilityKey.value = null
  const alias = champion ? aliasOf(champion) : null
  if (!champion || !version || !alias) return
  void loadChampion(champion)
  const english = await englishChampion(version, alias).catch(() => null)
  if (!english || champion !== abilityChampion.value) return
  const wanted = nameKey(props.reference.name)
  const named = [english.passive, ...english.spells.slice(0, 4)]
  named.forEach((ability, at) => {
    if (!ability || abilityKey.value) return
    const key = 'PQWER'[at]!
    const parts = abilityParts(ability.name)
    if (nameKey(ability.name) === wanted) abilityKey.value = { key }
    else if (parts.length > 1 && parts.some(part => nameKey(part) === wanted)) abilityKey.value = { key, part: { at: parts.findIndex(part => nameKey(part) === wanted), of: parts.length } }
  })
}, { immediate: true })

const item = computed(() => (props.reference.kind === 'item' && id.value !== null ? items.value[id.value] ?? null : null))
const spell = computed(() => (props.reference.kind === 'spell' && id.value !== null ? summoners.value[id.value] ?? null : null))
const perk = computed(() => (props.reference.kind === 'rune' && id.value !== null ? runeTree.value?.perks[id.value] ?? null : null))
const perkStyle = computed(() => (props.reference.kind === 'rune' && id.value !== null && !perk.value ? runeTree.value?.perkStyles[id.value] ?? null : null))
const champion = computed(() => (props.reference.kind === 'champion' && id.value !== null ? id.value : null))
const ability = computed(() => (abilityChampion.value && abilityKey.value ? championStatic(abilityChampion.value)?.championSpells[abilityKey.value.key] ?? null : null))
/** The ability's name in the player's language: the half the author wrote, for one of two forms. */
const abilityName = computed(() => (ability.value && abilityKey.value
  ? localPart({ name: props.reference.name, kind: 'ability', id: null, part: abilityKey.value.part, strict: false }, ability.value.name) ?? props.reference.name
  : null))

/** The name in the player's language, once the app knows the thing. */
const local = computed(() => item.value?.name ?? spell.value?.name ?? perk.value?.name ?? perkStyle.value?.name ?? abilityName.value ?? (champion.value ? nameOf(champion.value) : null))
const resolved = computed(() => !!(item.value || spell.value || perk.value || perkStyle.value || ability.value || champion.value))
</script>

<template>
  <span class="guide-ref mx-0.5 inline-flex items-center gap-1 align-middle">
    <template v-if="resolved">
      <GameTooltipItemIcon v-if="item" :item="item" :width="SIZE" :height="SIZE" class="shrink-0 rounded" />
      <GameTooltipSummonerSpellIcon v-else-if="spell" :spell="spell" :width="SIZE" :height="SIZE" class="shrink-0 rounded" />
      <GameTooltipPerkIcon v-else-if="perk" :perk="perk" :width="SIZE" :height="SIZE" class="shrink-0" />
      <GameTooltipPerkStyleIcon v-else-if="perkStyle" :style="perkStyle" :width="SIZE" :height="SIZE" class="shrink-0" />
      <GameTooltipChampionSpellIcon v-else-if="ability" :spell="ability" :width="SIZE" :height="SIZE" class="shrink-0 rounded" />
      <img v-else-if="champion && portraitOf(champion)" :src="portraitOf(champion)!" :alt="local ?? ''" :title="local ?? ''" :width="SIZE" :height="SIZE" class="img-skeleton shrink-0 rounded" loading="lazy">
      <span v-if="reference.named" class="font-semibold text-highlighted">{{ local }}</span>
    </template>
    <template v-else>
      <img v-if="reference.image" :src="reference.image" :alt="reference.name" :title="reference.name" :width="SIZE" :height="SIZE" class="img-skeleton shrink-0 rounded" loading="lazy">
      <span v-if="reference.named || !reference.image" class="font-semibold text-highlighted">{{ reference.name }}</span>
    </template>
  </span>
</template>
