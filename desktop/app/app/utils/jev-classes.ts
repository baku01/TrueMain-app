import type { Needs } from '~/utils/jev-needs'

/**
 * How a champion's class builds: Riot's thirteen subclasses (Controller:
 * Enchanter, Catcher; Fighter: Juggernaut, Diver; Mage: Burst, Battlemage,
 * Artillery; Marksman; Slayer: Assassin, Skirmisher; Tank: Vanguard, Warden;
 * Specialist), each champion's from the League of Legends Wiki
 * (wiki.leagueoflegends.com/en-us/Champion_classes, its `role` in
 * Module:ChampionData, read on 16.22: every champion Data Dragon lists).
 *
 * The champion's own measures stay the pool — what its players buy, at each
 * place (`placeShare`) — since champions leave their class's pattern (Kai'Sa's
 * Zhonya's Hourglass, Vayne's Jak'Sho). The class decides how the build
 * answers the enemy team on top of them (`ClassProfile`): the place a guard
 * item may take, the guard items the class buys at all, and what Jev reads of
 * how the class itemizes (`itemizationOf`, sent with the kit read). Every
 * number below is lolalytics' (Emerald+, 16.22, `build-full` item1–item5),
 * averaged over two to ten champions of the subclass on their main lane.
 */

export type Subclass = 'Enchanter' | 'Catcher' | 'Juggernaut' | 'Diver' | 'Burst' | 'Battlemage' | 'Artillery' | 'Marksman' | 'Assassin' | 'Skirmisher' | 'Vanguard' | 'Warden' | 'Specialist'

/** Each champion's subclasses, its main one first, by champion key (the wiki's `role`, 16.22). */
export const SUBCLASSES: Record<number, Subclass[]> = {
  266: ['Juggernaut'], // Aatrox
  103: ['Burst'], // Ahri
  84: ['Assassin'], // Akali
  166: ['Marksman', 'Assassin'], // Akshan
  12: ['Vanguard'], // Alistar
  799: ['Diver', 'Skirmisher'], // Ambessa
  32: ['Vanguard'], // Amumu
  34: ['Battlemage'], // Anivia
  1: ['Burst'], // Annie
  523: ['Marksman'], // Aphelios
  22: ['Marksman'], // Ashe
  136: ['Battlemage'], // Aurelion Sol
  893: ['Burst', 'Assassin'], // Aurora
  268: ['Specialist'], // Azir
  432: ['Catcher'], // Bard
  200: ['Skirmisher'], // Bel'Veth
  53: ['Catcher'], // Blitzcrank
  63: ['Burst'], // Brand
  201: ['Warden'], // Braum
  233: ['Diver'], // Briar
  51: ['Marksman'], // Caitlyn
  164: ['Diver'], // Camille
  69: ['Battlemage'], // Cassiopeia
  31: ['Specialist'], // Cho'Gath
  42: ['Marksman'], // Corki
  122: ['Juggernaut'], // Darius
  131: ['Assassin', 'Diver'], // Diana
  36: ['Juggernaut'], // Dr. Mundo
  119: ['Marksman'], // Draven
  245: ['Assassin'], // Ekko
  60: ['Diver'], // Elise
  28: ['Assassin'], // Evelynn
  81: ['Marksman'], // Ezreal
  9: ['Specialist'], // Fiddlesticks
  114: ['Skirmisher'], // Fiora
  105: ['Assassin'], // Fizz
  3: ['Warden'], // Galio
  41: ['Specialist'], // Gangplank
  86: ['Juggernaut'], // Garen
  150: ['Specialist'], // Gnar
  79: ['Vanguard'], // Gragas
  104: ['Specialist'], // Graves
  887: ['Skirmisher'], // Gwen
  120: ['Diver'], // Hecarim
  74: ['Specialist'], // Heimerdinger
  910: ['Artillery'], // Hwei
  420: ['Juggernaut'], // Illaoi
  39: ['Diver'], // Irelia
  427: ['Catcher'], // Ivern
  40: ['Enchanter'], // Janna
  59: ['Diver'], // Jarvan IV
  24: ['Skirmisher'], // Jax
  126: ['Artillery'], // Jayce
  202: ['Marksman', 'Catcher'], // Jhin
  222: ['Marksman'], // Jinx
  897: ['Warden', 'Skirmisher'], // K'Sante
  145: ['Marksman'], // Kai'Sa
  429: ['Marksman'], // Kalista
  43: ['Burst', 'Enchanter'], // Karma
  30: ['Battlemage'], // Karthus
  38: ['Assassin'], // Kassadin
  55: ['Assassin'], // Katarina
  10: ['Specialist'], // Kayle
  141: ['Skirmisher'], // Kayn
  85: ['Specialist'], // Kennen
  121: ['Assassin'], // Kha'Zix
  203: ['Marksman'], // Kindred
  240: ['Skirmisher'], // Kled
  96: ['Marksman'], // Kog'Maw
  7: ['Burst', 'Assassin'], // LeBlanc
  64: ['Diver'], // Lee Sin
  89: ['Vanguard'], // Leona
  876: ['Skirmisher'], // Lillia
  127: ['Burst'], // Lissandra
  805: ['Assassin'], // Locke
  236: ['Marksman'], // Lucian
  117: ['Enchanter'], // Lulu
  99: ['Burst', 'Artillery'], // Lux
  54: ['Vanguard'], // Malphite
  90: ['Battlemage'], // Malzahar
  57: ['Vanguard'], // Maokai
  11: ['Skirmisher'], // Master Yi
  800: ['Artillery'], // Mel
  902: ['Enchanter'], // Milio
  21: ['Marksman'], // Miss Fortune
  82: ['Juggernaut'], // Mordekaiser
  25: ['Catcher'], // Morgana
  950: ['Assassin'], // Naafiri
  267: ['Enchanter'], // Nami
  75: ['Juggernaut'], // Nasus
  111: ['Vanguard'], // Nautilus
  518: ['Burst', 'Catcher'], // Neeko
  76: ['Specialist'], // Nidalee
  895: ['Skirmisher'], // Nilah
  56: ['Assassin'], // Nocturne
  20: ['Vanguard'], // Nunu & Willump
  2: ['Diver'], // Olaf
  61: ['Burst'], // Orianna
  516: ['Vanguard'], // Ornn
  80: ['Diver'], // Pantheon
  78: ['Warden'], // Poppy
  555: ['Assassin', 'Catcher'], // Pyke
  246: ['Assassin'], // Qiyana
  133: ['Specialist'], // Quinn
  497: ['Catcher'], // Rakan
  33: ['Vanguard'], // Rammus
  421: ['Diver'], // Rek'Sai
  526: ['Vanguard'], // Rell
  888: ['Enchanter'], // Renata Glasc
  58: ['Diver'], // Renekton
  107: ['Assassin', 'Diver'], // Rengar
  92: ['Skirmisher'], // Riven
  68: ['Battlemage'], // Rumble
  13: ['Battlemage'], // Ryze
  360: ['Marksman'], // Samira
  113: ['Vanguard'], // Sejuani
  235: ['Marksman', 'Enchanter'], // Senna
  147: ['Burst', 'Enchanter'], // Seraphine
  875: ['Juggernaut'], // Sett
  35: ['Assassin'], // Shaco
  98: ['Warden'], // Shen
  102: ['Diver'], // Shyvana
  27: ['Specialist'], // Singed
  14: ['Vanguard'], // Sion
  15: ['Marksman'], // Sivir
  72: ['Vanguard', 'Juggernaut'], // Skarner
  901: ['Marksman'], // Smolder
  37: ['Enchanter'], // Sona
  16: ['Enchanter'], // Soraka
  50: ['Battlemage'], // Swain
  517: ['Burst', 'Skirmisher'], // Sylas
  134: ['Burst'], // Syndra
  223: ['Warden'], // Tahm Kench
  163: ['Battlemage'], // Taliyah
  91: ['Assassin'], // Talon
  44: ['Enchanter', 'Warden'], // Taric
  17: ['Specialist'], // Teemo
  412: ['Catcher'], // Thresh
  18: ['Marksman'], // Tristana
  48: ['Juggernaut'], // Trundle
  23: ['Skirmisher'], // Tryndamere
  4: ['Burst'], // Twisted Fate
  29: ['Marksman'], // Twitch
  77: ['Juggernaut'], // Udyr
  6: ['Juggernaut'], // Urgot
  110: ['Marksman', 'Artillery'], // Varus
  67: ['Marksman'], // Vayne
  45: ['Burst'], // Veigar
  161: ['Artillery'], // Vel'Koz
  711: ['Burst'], // Vex
  254: ['Diver'], // Vi
  234: ['Skirmisher'], // Viego
  112: ['Battlemage'], // Viktor
  8: ['Battlemage'], // Vladimir
  106: ['Juggernaut'], // Volibear
  19: ['Diver'], // Warwick
  62: ['Diver'], // Wukong
  498: ['Marksman'], // Xayah
  101: ['Artillery'], // Xerath
  5: ['Diver'], // Xin Zhao
  157: ['Skirmisher'], // Yasuo
  777: ['Assassin', 'Skirmisher'], // Yone
  83: ['Juggernaut'], // Yorick
  804: ['Marksman'], // Yunara
  350: ['Enchanter'], // Yuumi
  904: ['Skirmisher'], // Zaahen
  154: ['Vanguard'], // Zac
  238: ['Assassin'], // Zed
  221: ['Marksman'], // Zeri
  115: ['Artillery'], // Ziggs
  26: ['Specialist'], // Zilean
  142: ['Burst'], // Zoe
  143: ['Catcher'], // Zyra
}

/**
 * A champion's broad Riot class as a subclass, for a Specialist — "unclassified",
 * the wiki says: Azir, Cho'Gath, Graves, Zilean… — and a champion released
 * after the table: Zilean (Support, Mage) builds as an enchanter, Graves
 * (Marksman) as a marksman, Cho'Gath (Tank, Mage) as a vanguard.
 */
const BY_TAG: Record<string, Exclude<Subclass, 'Specialist'>> = {
  Marksman: 'Marksman',
  Mage: 'Burst',
  Assassin: 'Assassin',
  Fighter: 'Diver',
  Tank: 'Vanguard',
  Support: 'Enchanter',
}

const MAGES = new Set<Subclass>(['Burst', 'Battlemage', 'Artillery'])

/**
 * The subclass a champion builds as on `position`: its main one, but a mage
 * that is also an enchanter (Seraphine, Karma: Burst and Enchanter) builds as
 * an enchanter on the support lane; a Specialist, or a champion the table
 * misses, by its main Riot class (`BY_TAG`).
 */
export function subclassOf(champion: { id: number, classes: string[] }, position: string): Exclude<Subclass, 'Specialist'> {
  const [main, second] = SUBCLASSES[champion.id] ?? []
  if (position === 'UTILITY' && second === 'Enchanter' && main && MAGES.has(main)) return 'Enchanter'
  if (main && main !== 'Specialist') return main
  return BY_TAG[champion.classes[0] ?? ''] ?? 'Diver'
}

/**
 * A guard item: one that protects its holder — armor or magic resist, or
 * health with no damage of its own (Guardian Angel, Zhonya's Hourglass,
 * Randuin's Omen, Warmog's Armor, Locket of the Iron Solari) — as opposed to
 * a damage item that carries health (Black Cleaver, Rylai's Crystal Scepter,
 * Edge of Night). Boots apart: their slot reads its own.
 */
export function isGuard(tags: string[], gold: number): boolean {
  if (tags.includes('Boots') || tags.includes('Consumable')) return false
  if (tags.includes('Armor') || tags.includes('SpellBlock')) return true
  return tags.includes('Health') && !tags.some(tag => tag === 'Damage' || tag === 'SpellDamage' || tag === 'AttackSpeed' || tag === 'CriticalStrike') && gold >= 2000
}

/** A support's guard item: no more than this much gold (Locket of the Iron Solari 2,200, Knight's Vow, Mikael's Blessing, Bandlepipes 2,300). */
export const SUPPORT_GOLD = 2300

/**
 * A champion's share of games past which an item is its own whatever its
 * class: Ezreal's Frozen Heart (7 % of his games), Kai'Sa's Zhonya's
 * Hourglass (19 %), Vayne's Jak'Sho (20 %) — and not Vayne's Randuin's Omen
 * (3 %), Kai'Sa's Jak'Sho (1.2 %) or Sivir's Randuin's Omen (1.3 %).
 */
export const OWN_SHARE = 0.05

export interface ClassProfile {
  /** What the class builds: its stats and item families, as Jev reads them. */
  builds: string
  /** What the class never builds, whatever its stats would answer. */
  never: string
  /** How the class answers each need of the enemy team with its own items. */
  answers: Partial<Record<keyof Needs, string>>
  /**
   * The first completed item a guard item may take (1 the first): the first
   * place where the class's guard items reach 1.5 % of its games — a
   * resistance a rule makes due waits for it too (`dueAt`).
   */
  guardFrom: number
  /** The guard items the class buys (`isGuard`): every one, a support's (`SUPPORT_GOLD`), or these. */
  guards: 'all' | 'support' | number[]
}

const GUARDIAN_ANGEL = 3026
const MAW = 3156
const MERCURIAL = 3139
const WITS_END = 3091
const ZHONYAS = 3157
const BANSHEES = 3102
const DEATHS_DANCE = 6333
const FROZEN_HEART = 3110
const SPIRIT_VISAGE = 3065
const ABYSSAL_MASK = 8020

const MAGE_NEVER = 'Attack-damage items, fighters\' items (Sterak\'s Gage, Death\'s Dance) and tanks\' items (Randuin\'s Omen, Thornmail, Warmog\'s Armor)'

export const CLASS_PROFILES: Record<Exclude<Subclass, 'Specialist'>, ClassProfile> = {
  // Ashe, Jinx, Caitlyn, Jhin, Kai'Sa, Lucian, Sivir, Miss Fortune, Ezreal, Vayne (bottom): guard items 0.7 % of third
  // items, 1.9 % of fourth (Guardian Angel 0.9), 5.9 % of fifth (Guardian Angel 4.5, Maw 0.6, Mercurial 0.7); Death's
  // Dance, Randuin's Omen, Thornmail under 0.1 % at every place.
  Marksman: {
    builds: 'Attack damage dealt by basic attacks: critical strike, attack speed and on-hit items (Infinity Edge, Phantom Dancer, Kraken Slayer), lethality for a few (Jhin, Miss Fortune), armor penetration against tanks. Its first three items deal damage; defense comes from the fourth.',
    never: 'Fighters\' and tanks\' items (Death\'s Dance, Sterak\'s Gage, Randuin\'s Omen, Thornmail, Jak\'Sho, Dead Man\'s Plate, Force of Nature), and ability-power items on an attack-damage build',
    answers: {
      physical: 'Guardian Angel as a fourth or fifth item; Plated Steelcaps',
      magic: 'Maw of Malmortius, Mercurial Scimitar or Wit\'s End late; Mercury\'s Treads',
      burst: 'Guardian Angel, Immortal Shieldbow, Maw of Malmortius; Plated Steelcaps against attack-damage assassins',
      cc: 'Mercurial Scimitar; Mercury\'s Treads',
      heal: 'Mortal Reminder',
      tanks: 'Lord Dominik\'s Regards, Kraken Slayer, Blade of the Ruined King, Terminus',
    },
    guardFrom: 4,
    guards: [GUARDIAN_ANGEL, MAW, MERCURIAL, WITS_END],
  },
  // Syndra, Annie, LeBlanc, Veigar, Ahri, Orianna (middle): guard items 4.5 % of second items, 15.1 % of third
  // (Zhonya's 13.8, Banshee's 1.3).
  Burst: {
    builds: 'Ability power, magic penetration and mana for one burst combo: Luden\'s Echo, Malignance, Shadowflame, Stormsurge, Rabadon\'s Deathcap, Void Staff.',
    never: MAGE_NEVER,
    answers: {
      physical: 'Zhonya\'s Hourglass, often the second or third item',
      magic: 'Banshee\'s Veil',
      burst: 'Zhonya\'s Hourglass, Banshee\'s Veil',
      cc: 'Banshee\'s Veil; Mercury\'s Treads',
      heal: 'Morellonomicon',
      tanks: 'Void Staff, Liandry\'s Torment, Cryptbloom',
    },
    guardFrom: 2,
    guards: [ZHONYAS, BANSHEES],
  },
  // Viktor, Cassiopeia, Ryze, Vladimir, Swain, Anivia (middle): guard items 4.5 % of second items, 16.5 % of third
  // (Zhonya's 14.7, Frozen Heart, Spirit Visage, Banshee's under 1 each).
  Battlemage: {
    builds: 'Ability power with health and mana for long fights: Rod of Ages, Archangel\'s Staff, Liandry\'s Torment, Rylai\'s Crystal Scepter, Riftmaker.',
    never: MAGE_NEVER,
    answers: {
      physical: 'Zhonya\'s Hourglass; Frozen Heart',
      magic: 'Banshee\'s Veil, Spirit Visage, Abyssal Mask',
      burst: 'Zhonya\'s Hourglass, Banshee\'s Veil',
      cc: 'Banshee\'s Veil; Mercury\'s Treads',
      heal: 'Morellonomicon',
      tanks: 'Liandry\'s Torment, Void Staff, Riftmaker',
    },
    guardFrom: 2,
    guards: [ZHONYAS, BANSHEES, FROZEN_HEART, SPIRIT_VISAGE, ABYSSAL_MASK],
  },
  // Xerath, Ziggs, Vel'Koz, Hwei (middle): guard items 6.2 % of second items, 12.0 % of third (Zhonya's 10.7).
  Artillery: {
    builds: 'Ability power, mana and range to poke from afar: Luden\'s Echo, Blackfire Torch, Shadowflame, Horizon Focus, Rabadon\'s Deathcap.',
    never: MAGE_NEVER,
    answers: {
      physical: 'Zhonya\'s Hourglass',
      magic: 'Banshee\'s Veil',
      burst: 'Zhonya\'s Hourglass, Banshee\'s Veil',
      cc: 'Banshee\'s Veil; Mercury\'s Treads',
      heal: 'Morellonomicon',
      tanks: 'Void Staff, Liandry\'s Torment',
    },
    guardFrom: 2,
    guards: [ZHONYAS, BANSHEES],
  },
  // Zed, Talon, Akali, Katarina, Fizz, Qiyana (middle): guard items 7.2 % of second items (Zhonya's 6.6 on the
  // ability-power ones), 16.0 % of third (Zhonya's 11.9, Death's Dance 3.1); Edge of Night 4.3 % of third.
  Assassin: {
    builds: 'Burst to kill one target: lethality and attack damage (Hubris, Profane Hydra, Youmuu\'s Ghostblade, Serylda\'s Grudge), or ability power with magic penetration (Lich Bane, Shadowflame, Hextech Rocketbelt).',
    never: 'Tanks\' items (Randuin\'s Omen, Thornmail, Jak\'Sho, Warmog\'s Armor) and supports\' items',
    answers: {
      physical: 'Death\'s Dance on attack damage, Zhonya\'s Hourglass on ability power; Plated Steelcaps',
      magic: 'Maw of Malmortius or Edge of Night on attack damage, Banshee\'s Veil on ability power',
      burst: 'Edge of Night, Zhonya\'s Hourglass, Guardian Angel late',
      cc: 'Edge of Night, Banshee\'s Veil; Mercury\'s Treads',
      heal: 'Chempunk Chainsword, Morellonomicon',
      tanks: 'Serylda\'s Grudge, Lord Dominik\'s Regards, Void Staff',
    },
    guardFrom: 2,
    guards: [ZHONYAS, BANSHEES, DEATHS_DANCE, MAW, GUARDIAN_ANGEL],
  },
  // Fiora, Jax, Riven, Gwen (top): guard items 3.8 % of first items, 25.4 % of third (Death's Dance 15.6, Zhonya's on
  // Gwen 6.3, Maw 2.4); Randuin's Omen 0.3 %.
  Skirmisher: {
    builds: 'Sustained melee damage to duel: attack damage, attack speed, life steal and omnivamp (Ravenous Hydra, Trinity Force, Eclipse, Blade of the Ruined King), or ability power on-hit (Riftmaker, Nashor\'s Tooth).',
    never: 'Tanks\' items with no damage (Randuin\'s Omen, Thornmail, Jak\'Sho, Warmog\'s Armor) and supports\' items',
    answers: {
      physical: 'Death\'s Dance; Zhonya\'s Hourglass on ability power; Plated Steelcaps',
      magic: 'Maw of Malmortius, Wit\'s End, Mercurial Scimitar; Banshee\'s Veil on ability power',
      burst: 'Death\'s Dance, Maw of Malmortius, Sterak\'s Gage, Guardian Angel late',
      cc: 'Mercurial Scimitar, Sterak\'s Gage; Mercury\'s Treads',
      heal: 'Chempunk Chainsword, Mortal Reminder',
      tanks: 'Blade of the Ruined King, Black Cleaver, Lord Dominik\'s Regards',
    },
    guardFrom: 1,
    guards: [DEATHS_DANCE, ZHONYAS, MAW, WITS_END, MERCURIAL, GUARDIAN_ANGEL, BANSHEES],
  },
  // Darius, Garen, Mordekaiser, Sett, Aatrox (top): guard items 1.8 % of first items, 16.4 % of second (Dead Man's
  // Plate 7.9, Death's Dance 2.8, Force of Nature 2.2), 25.1 % of third.
  Juggernaut: {
    builds: 'Health with attack damage or ability power and sustain, to brawl at the front: Stridebreaker, Black Cleaver, Sterak\'s Gage, Overlord\'s Bloodmail, Riftmaker, Liandry\'s Torment.',
    never: 'Squishy carries\' items: critical strike, lethality burst, supports\' items',
    answers: {
      physical: 'Dead Man\'s Plate, Death\'s Dance, Thornmail, Randuin\'s Omen',
      magic: 'Force of Nature, Spirit Visage, Maw of Malmortius, Kaenic Rookern',
      burst: 'Sterak\'s Gage, Death\'s Dance',
      cc: 'Sterak\'s Gage; Mercury\'s Treads',
      heal: 'Thornmail, Chempunk Chainsword',
      tanks: 'Black Cleaver, Liandry\'s Torment',
      autos: 'Thornmail, Randuin\'s Omen',
    },
    guardFrom: 1,
    guards: 'all',
  },
  // Vi, Jarvan IV, Xin Zhao, Lee Sin, Hecarim (jungle): guard items 1.3 % of first items, 17.8 % of second (Death's
  // Dance 15.2), 37.6 % of third (Death's Dance 23.2, Guardian Angel 7.2, Maw 4.3).
  Diver: {
    builds: 'Attack damage with health and ability haste to dive one target: Eclipse, Black Cleaver, Profane or Titanic Hydra, Trinity Force, Sundered Sky, Spear of Shojin.',
    never: 'Critical strike and supports\' items',
    answers: {
      physical: 'Death\'s Dance, Guardian Angel, Randuin\'s Omen',
      magic: 'Maw of Malmortius, Spirit Visage, Force of Nature',
      burst: 'Guardian Angel, Death\'s Dance, Sterak\'s Gage, Maw of Malmortius',
      cc: 'Sterak\'s Gage; Mercury\'s Treads',
      heal: 'Chempunk Chainsword, Thornmail',
      tanks: 'Black Cleaver, Serylda\'s Grudge, Lord Dominik\'s Regards',
    },
    guardFrom: 2,
    guards: 'all',
  },
  // Ornn, Malphite, Sion (top), Leona, Nautilus, Alistar, Rell (support): guard items 36.7 % of first items (Sunfire
  // Aegis 12.7), 87.3 % of second (Locket 32.8, Zeke's 14.4, Thornmail 8.0).
  Vanguard: {
    builds: 'Health, armor and magic resist to engage and soak: Sunfire Aegis, Hollow Radiance, Heartsteel, Thornmail, Jak\'Sho, Unending Despair; on the support lane Locket of the Iron Solari, Zeke\'s Convergence, Knight\'s Vow.',
    never: 'Carries\' damage items: critical strike, lethality, ability-power burst',
    answers: {
      physical: 'Thornmail, Randuin\'s Omen, Frozen Heart, Dead Man\'s Plate',
      magic: 'Kaenic Rookern, Force of Nature, Spirit Visage, Jak\'Sho; Locket of the Iron Solari for the team',
      burst: 'Locket of the Iron Solari, Jak\'Sho',
      cc: 'Mercury\'s Treads, Kaenic Rookern',
      heal: 'Thornmail',
      autos: 'Randuin\'s Omen, Frozen Heart, Thornmail',
    },
    guardFrom: 1,
    guards: 'all',
  },
  // Braum, Taric (support), Shen, Poppy (top): guard items 21.4 % of first items, 76.3 % of second (Locket 32.1, Knight's
  // Vow 5.3, Thornmail 4.5).
  Warden: {
    builds: 'Health and resistances to guard allies: Locket of the Iron Solari, Knight\'s Vow, Winter\'s Approach, Thornmail, Frozen Heart, Kaenic Rookern.',
    never: 'Carries\' damage items: critical strike, lethality, ability-power burst',
    answers: {
      physical: 'Thornmail, Frozen Heart, Randuin\'s Omen, Knight\'s Vow',
      magic: 'Kaenic Rookern, Spirit Visage, Locket of the Iron Solari',
      burst: 'Locket of the Iron Solari, Knight\'s Vow',
      cc: 'Mercury\'s Treads, Mikael\'s Blessing',
      heal: 'Thornmail',
      autos: 'Randuin\'s Omen, Frozen Heart, Thornmail',
    },
    guardFrom: 1,
    guards: 'all',
  },
  // Lulu, Janna, Nami, Soraka, Milio, Sona (support; their first item is the support item, their own first is
  // lolalytics' second): guard items 6.8 % of second items (Mikael's 4.6), 17.4 % of third (Redemption apart: Locket
  // 1.5, Knight's Vow 1.9, Mikael's 7.6); a damage item's resistance (Zhonya's, Banshee's) under 0.1 %.
  Enchanter: {
    builds: 'Heal and shield power, ability haste and mana regeneration to empower allies: Moonstone Renewer, Echoes of Helia, Ardent Censer, Redemption, Mikael\'s Blessing, Shurelya\'s Battlesong, Staff of Flowing Water.',
    never: 'Its own resistances on a damage item (Zhonya\'s Hourglass, Banshee\'s Veil) and tanks\' items (Randuin\'s Omen, Thornmail): it protects its carries instead',
    answers: {
      physical: 'Locket of the Iron Solari, Knight\'s Vow',
      magic: 'Locket of the Iron Solari',
      burst: 'Locket of the Iron Solari, Redemption, Moonstone Renewer',
      cc: 'Mikael\'s Blessing',
      heal: 'Chemtech Putrifier',
    },
    guardFrom: 1,
    guards: 'support',
  },
  // Thresh, Blitzcrank, Rakan, Bard, Morgana, Zyra (support): guard items 64.3 % of second items (Locket 34.0, Zeke's
  // 12.0, Dead Man's Plate 8.1); the mages among them (Morgana, Zyra) build Liandry's and Zhonya's.
  Catcher: {
    builds: 'Engage or pick tools with tanks\' or supports\' items: Locket of the Iron Solari, Zeke\'s Convergence, Knight\'s Vow, Dead Man\'s Plate; its mages (Morgana, Zyra) build Liandry\'s Torment, Rylai\'s Crystal Scepter, Zhonya\'s Hourglass.',
    never: 'Critical strike and lethality',
    answers: {
      physical: 'Frozen Heart, Thornmail, Knight\'s Vow; Zhonya\'s Hourglass on a mage',
      magic: 'Locket of the Iron Solari, Kaenic Rookern',
      burst: 'Locket of the Iron Solari',
      cc: 'Mikael\'s Blessing; Mercury\'s Treads',
      heal: 'Morellonomicon, Thornmail',
    },
    guardFrom: 1,
    guards: 'all',
  },
}

/** Whether the class of `profile` buys item `id` (`tags`, `gold`): any item that is no guard, and its guard items (`ClassProfile.guards`). */
export function classBuys(profile: ClassProfile, id: number, tags: string[], gold: number): boolean {
  if (!isGuard(tags, gold)) return true
  if (profile.guards === 'all') return true
  if (profile.guards === 'support') return gold <= SUPPORT_GOLD
  return profile.guards.includes(id)
}

const NEED_WORDS: Record<keyof Needs, string> = {
  physical: 'against physical damage',
  magic: 'against magic damage',
  burst: 'against burst',
  cc: 'against crowd control',
  heal: 'against healing',
  tanks: 'against tanks',
  autos: 'against basic attackers',
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']

/** How the class itemizes, as Jev reads it with our champion's kit: short text under descriptive names. */
export function itemizationOf(subclass: Exclude<Subclass, 'Specialist'>) {
  const profile = CLASS_PROFILES[subclass]
  return {
    class: subclass,
    builds: profile.builds,
    neverBuilds: profile.never,
    defensiveItemsFrom: `its ${ORDINALS[profile.guardFrom - 1]} completed item`,
    answers: Object.fromEntries(Object.entries(profile.answers).map(([need, items]) => [NEED_WORDS[need as keyof Needs], items])),
  }
}
