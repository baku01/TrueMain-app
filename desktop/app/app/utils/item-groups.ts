/**
 * The item groups the game limits — at most `max` of a group's items in one
 * inventory: one Lifeline item (Sterak's Gage, Maw of Malmortius, Immortal
 * Shieldbow…), one Last Whisper item (Black Cleaver, Lord Dominik's Regards,
 * Mortal Reminder…), one pair of boots. A snapshot of the game's own item data
 * (Community Dragon's `items.cdtb.bin.json`, `mItemGroups` and
 * `mMaxGroupOwnable`) for the items Data Dragon 16.22.1 lists on Summoner's
 * Rift; an item released after it is in no group until the table is
 * regenerated: `node tools/item-groups.mjs > app/app/utils/item-groups.ts`.
 */
export const ITEM_GROUPS: Record<string, { max: number, items: number[] }> = {
  // Rod of Ages
  '{10ff67ed}': { max: 1, items: [6657, 326657] },
  // Echoes of Helia
  '{1410b5c7}': { max: 1, items: [6620, 326620] },
  // Trailblazer
  '{1cd86300}': { max: 1, items: [3002, 323002] },
  // Veigar's Talisman of Ascension, The Golden Spatula
  '{4fd436c4}': { max: 1, items: [663064, 664403] },
  // Banshee's Veil, Edge of Night, Verdant Barrier
  '{548f93b0}': { max: 1, items: [3102, 3814, 4632] },
  // Dusk and Dawn, Sheen, Trinity Force, Lich Bane, Essence Reaver, Bloodsong, Iceborn Gauntlet
  '{57352a0f}': { max: 1, items: [2510, 3057, 3078, 3100, 3508, 3877, 6662] },
  // Dawncore
  '{6fcc6138}': { max: 1, items: [6621, 326621] },
  // Moonstone Renewer
  '{81091299}': { max: 1, items: [6617, 326617] },
  // Locket of the Iron Solari
  '{889717e0}': { max: 1, items: [3190, 323190] },
  // Ravenous Hydra, Titanic Hydra, Profane Hydra
  '{8c259571}': { max: 3, items: [3074, 3748, 6698] },
  // Whispering Circlet
  '{9e0158a0}': { max: 1, items: [2526, 322526] },
  // Manamune, Muramana
  '{a4ceabbc}': { max: 1, items: [3004, 3042, 323004, 323042] },
  // Archangel's Staff, Seraph's Embrace
  '{a6ceaee2}': { max: 1, items: [3003, 3040, 323003, 323040] },
  // Whispering Circlet, Diadem of Songs
  '{aa03aa1b}': { max: 1, items: [2526, 2530, 322526, 322530] },
  // Ravenous Hydra, Tiamat, Titanic Hydra, Stridebreaker, Profane Hydra
  '{c6428663}': { max: 1, items: [3074, 3077, 3748, 6631, 6698] },
  // Shurelya's Battlesong
  '{d11f947a}': { max: 1, items: [2065, 322065] },
  // Thornmail, Bramble Vest
  '{d52cd27b}': { max: 1, items: [3075, 3076, 323075] },
  // Atma's Reckoning, Hextech Gunblade, Zephyr, Sword of Blossoming Dawn
  '{d790b43f}': { max: 99, items: [663039, 663146, 663172, 664011] },
  // Trailblazer, Dead Man's Plate
  '{db01f901}': { max: 1, items: [3002, 3742, 323002] },
  // Zeke's Convergence
  '3050': { max: 1, items: [3050, 323050] },
  // Thornmail
  '3075': { max: 1, items: [3075, 323075] },
  // Redemption
  '3107': { max: 1, items: [3107, 323107] },
  // Knight's Vow
  '3109': { max: 1, items: [3109, 323109] },
  // Frozen Heart
  '3110': { max: 1, items: [3110, 323110] },
  // Winter's Approach
  '3119': { max: 1, items: [3119, 323119] },
  // Winter's Approach, Fimbulwinter
  '3121': { max: 1, items: [3119, 3121, 323119, 323121] },
  // Mikael's Blessing
  '3222': { max: 1, items: [3222, 323222] },
  // Ardent Censer
  '3504': { max: 1, items: [3504, 323504] },
  // Imperial Mandate
  '4005': { max: 1, items: [4005, 324005] },
  // Staff of Flowing Water
  '6616': { max: 1, items: [6616, 326616] },
  // The Collector
  '6676': { max: 1, items: [6676, 667666] },
  // Abyssal Mask
  '8020': { max: 1, items: [8020, 328020] },
  // Boots, Slightly Magical Footwear, Berserker's Greaves, Gluttonous Greaves, Boots of Swiftness, Symbiotic Soles, Synchronized Souls, Sorcerer's Shoes, Plated Steelcaps, Mercury's Treads, Mobility Boots, Ionian Boots of Lucidity, Immortal Path, Swiftmarch, Crimson Lucidity, Gunmetal Greaves, Chainlaced Crushers, Armored Advance, Spellslinger's Shoes, Forever Forward
  'Boots': { max: 1, items: [1001, 2422, 3006, 3008, 3009, 3010, 3013, 3020, 3047, 3111, 3117, 3158, 3168, 3170, 3171, 3172, 3173, 3174, 3175, 3176] },
  // Boots, Slightly Magical Footwear, Berserker's Greaves, Gluttonous Greaves, Boots of Swiftness, Symbiotic Soles, Synchronized Souls, Sorcerer's Shoes, Plated Steelcaps, Mercury's Treads, Mobility Boots, Ionian Boots of Lucidity, Immortal Path, Forever Forward
  'BootsWithoutActives': { max: 1, items: [1001, 2422, 3006, 3008, 3009, 3010, 3013, 3020, 3047, 3111, 3117, 3158, 3168, 3176] },
  // Doran's Shield, Doran's Blade, Doran's Ring, Doran's Bow, Scorchclaw Pup, Gustwalker Hatchling, Mosstomper Seedling, Doran's Helm, World Atlas, Runic Compass, Bounty of Worlds, Celestial Opposition, Dream Maker, Zaz'Zak's Realmspike, Solstice Sleigh, Bloodsong
  'DoransItems': { max: 1, items: [1054, 1055, 1056, 1086, 1101, 1102, 1103, 1105, 1106, 1107, 1120, 3865, 3866, 3867, 3869, 3870, 3871, 3876, 3877] },
  // Catalyst of Aeons, Rod of Ages
  'EternityItems': { max: 1, items: [3803, 6657, 326657] },
  // Dark Seal, Mejai's Soulstealer
  'Glory': { max: 1, items: [1082, 3041] },
  // Scorchclaw Pup, Gustwalker Hatchling, Mosstomper Seedling, World Atlas, Runic Compass, Bounty of Worlds, Celestial Opposition, Dream Maker, Zaz'Zak's Realmspike, Solstice Sleigh, Bloodsong
  'GoldItems': { max: 1, items: [1101, 1102, 1103, 1105, 1106, 1107, 3865, 3866, 3867, 3869, 3870, 3871, 3876, 3877] },
  // Guardian's Horn, Guardian's Orb, Guardian's Blade, Guardian's Hammer
  'GuardianItems': { max: 1, items: [2051, 3112, 3177, 3184] },
  // Scorchclaw Pup, Gustwalker Hatchling, Mosstomper Seedling
  'HuntersTalismanGroup': { max: 1, items: [1101, 1102, 1103, 1105, 1106, 1107] },
  // Sunfire Aegis, Bami's Cinder, Hollow Radiance
  'ImmolateItems': { max: 1, items: [3068, 6660, 6664] },
  // Mortal Reminder, Last Whisper, Lord Dominik's Regards, Black Cleaver, Terminus, Serylda's Grudge
  'LastWhisper': { max: 1, items: [3033, 3035, 3036, 3071, 3302, 6694] },
  // Protoplasm Harness, Archangel's Staff, Seraph's Embrace, Sterak's Gage, Hexdrinker, Maw of Malmortius, Immortal Shieldbow
  'LifelineItems': { max: 1, items: [2525, 3003, 3040, 3053, 3155, 3156, 6673, 323003, 323040] },
  // Lost Chapter, Leeching Leer, Night Harvester
  'MythicItems': { max: 1, items: [3802, 4635, 4636] },
  // Health Potion, Refillable Potion, Corrupting Potion
  'Potion': { max: 1, items: [2003, 2031, 2033] },
  // Mercurial Scimitar, Quicksilver Sash
  'Quicksilver': { max: 1, items: [3139, 3140] },
  // Seeker's Armguard, Shattered Armguard
  'StopwatchGroup': { max: 1, items: [2420, 2421] },
  // Whispering Circlet, Archangel's Staff, Manamune, Tear of the Goddess, Winter's Approach
  'TearItems': { max: 1, items: [2526, 3003, 3004, 3070, 3119, 322526, 323003, 323004, 323070, 323119] },
  // Kalista's Black Spear
  'TheBlackSpear': { max: 1, items: [3599, 3600] },
  // Void Staff, Cryptbloom, Terminus, Blighting Jewel, Bloodletter's Curse
  'VoidPen': { max: 1, items: [3135, 3137, 3302, 4630, 8010] },
}

const groupsOf = new Map<number, { max: number, items: number[] }[]>()
for (const group of Object.values(ITEM_GROUPS)) for (const id of group.items) groupsOf.set(id, [...(groupsOf.get(id) ?? []), group])

/** Whether `itemId` can join `held`: no group of it already full. */
export const fitsWith = (itemId: number, held: readonly number[]): boolean =>
  !held.includes(itemId) && (groupsOf.get(itemId) ?? []).every(group => held.filter(id => group.items.includes(id)).length < group.max)

/** Every pair of boots and its upgrades. */
export const BOOTS: ReadonlySet<number> = new Set(ITEM_GROUPS.Boots?.items ?? [])

/**
 * The starting items that grow by themselves — the jungle pets and the
 * support item with its upgrades: bought once at the start, never a choice
 * later, and holding an inventory slot the whole game.
 */
export const STARTER_LINE: ReadonlySet<number> = new Set(ITEM_GROUPS.GoldItems?.items ?? [])
