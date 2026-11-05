// Regenerates `app/app/utils/item-groups.ts`: the item groups the game limits
// (Lifeline, Last Whisper, Immolate, boots…), read from Community Dragon's dump
// of the game's item data, for the items Data Dragon lists on Summoner's Rift.
//   node tools/item-groups.mjs > app/app/utils/item-groups.ts
const version = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0]
const { data: items } = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`)).json()
const bin = await (await fetch('https://raw.communitydragon.org/latest/game/items.cdtb.bin.json')).json()

const groups = new Map()
for (const [id, item] of Object.entries(items)) {
  if (!item.maps?.['11']) continue
  for (const path of bin[`Items/${id}`]?.mItemGroups ?? []) {
    const group = bin[path]
    if (path === 'Items/ItemGroups/Default' || group?.__type !== 'ItemGroup' || !(group.mMaxGroupOwnable >= 1)) continue
    const name = group.mItemGroupID ?? path
    if (!groups.has(name)) groups.set(name, { max: group.mMaxGroupOwnable, items: new Set() })
    groups.get(name).items.add(Number(id))
  }
}
const shared = [...groups].filter(([, group]) => group.items.size >= 2).sort(([a], [b]) => a.localeCompare(b))
const label = ids => [...new Set(ids.map(id => items[id].name))].join(', ')

console.log(`/**
 * The item groups the game limits — at most \`max\` of a group's items in one
 * inventory: one Lifeline item (Sterak's Gage, Maw of Malmortius, Immortal
 * Shieldbow…), one Last Whisper item (Black Cleaver, Lord Dominik's Regards,
 * Mortal Reminder…), one pair of boots. A snapshot of the game's own item data
 * (Community Dragon's \`items.cdtb.bin.json\`, \`mItemGroups\` and
 * \`mMaxGroupOwnable\`) for the items Data Dragon ${version} lists on Summoner's
 * Rift; an item released after it is in no group until the table is
 * regenerated: \`node tools/item-groups.mjs > app/app/utils/item-groups.ts\`.
 */
export const ITEM_GROUPS: Record<string, { max: number, items: number[] }> = {`)
for (const [name, group] of shared) console.log(`  // ${label([...group.items])}\n  '${name}': { max: ${group.max}, items: [${[...group.items].sort((a, b) => a - b).join(', ')}] },`)
console.log(`}

const groupsOf = new Map<number, { max: number, items: number[] }[]>()
for (const group of Object.values(ITEM_GROUPS)) for (const id of group.items) groupsOf.set(id, [...(groupsOf.get(id) ?? []), group])

/** Whether \`itemId\` can join \`held\`: no group of it already full. */
export const fitsWith = (itemId: number, held: readonly number[]): boolean =>
  !held.includes(itemId) && (groupsOf.get(itemId) ?? []).every(group => held.filter(id => group.items.includes(id)).length < group.max)

/** Every pair of boots and its upgrades. */
export const BOOTS: ReadonlySet<number> = new Set(ITEM_GROUPS.Boots?.items ?? [])

/**
 * The starting items that grow by themselves — the jungle pets and the
 * support item with its upgrades: bought once at the start, never a choice
 * later, and holding an inventory slot the whole game.
 */
export const STARTER_LINE: ReadonlySet<number> = new Set(ITEM_GROUPS.GoldItems?.items ?? [])`)
