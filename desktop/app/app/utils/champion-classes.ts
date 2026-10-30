/**
 * Champion classes and subclasses, Riot's own scheme: a class says what a
 * champion does in a fight, a subclass how. Seven classes, thirteen
 * subclasses — a marksman or a specialist is its own subclass.
 *
 * Data Dragon carries only the coarse tags (`Fighter`, `Mage`, …), so the
 * subclasses are a snapshot of the League wiki's champion data
 * (`Module:ChampionData`, CC BY-SA 3.0, `role` of each champion, keyed by the
 * champion's numeric id). A champion Riot released after the snapshot is not
 * in the table and shows under "unclassified" until the table is refreshed.
 */
export type ClassId = 'tank' | 'fighter' | 'slayer' | 'mage' | 'marksman' | 'controller' | 'specialist'

export type SubclassId =
  | 'vanguard' | 'warden'
  | 'diver' | 'juggernaut'
  | 'assassin' | 'skirmisher'
  | 'burst' | 'battlemage' | 'artillery'
  | 'marksman'
  | 'enchanter' | 'catcher'
  | 'specialist'

export interface ClassDef {
  id: ClassId
  icon: string
  subclasses: SubclassId[]
}

/** In the order the page lists them: from the front line to the back. */
export const CLASSES: ClassDef[] = [
  { id: 'tank', icon: 'i-ph-shield-light', subclasses: ['vanguard', 'warden'] },
  { id: 'fighter', icon: 'i-ph-sword-light', subclasses: ['diver', 'juggernaut'] },
  { id: 'slayer', icon: 'i-ph-knife-light', subclasses: ['assassin', 'skirmisher'] },
  { id: 'mage', icon: 'i-ph-magic-wand-light', subclasses: ['burst', 'battlemage', 'artillery'] },
  { id: 'marksman', icon: 'i-ph-crosshair-simple-light', subclasses: ['marksman'] },
  { id: 'controller', icon: 'i-ph-handshake-light', subclasses: ['enchanter', 'catcher'] },
  { id: 'specialist', icon: 'i-ph-sparkle-light', subclasses: ['specialist'] },
]

/** Champion id → its subclasses, comma-separated, the main one first. */
const SUBCLASSES: Record<number, string> = {
  1: 'burst', // Annie
  2: 'diver', // Olaf
  3: 'warden', // Galio
  4: 'burst', // Twisted Fate
  5: 'diver', // Xin Zhao
  6: 'juggernaut', // Urgot
  7: 'burst,assassin', // LeBlanc
  8: 'battlemage', // Vladimir
  9: 'specialist', // Fiddlesticks
  10: 'specialist', // Kayle
  11: 'skirmisher', // Master Yi
  12: 'vanguard', // Alistar
  13: 'battlemage', // Ryze
  14: 'vanguard', // Sion
  15: 'marksman', // Sivir
  16: 'enchanter', // Soraka
  17: 'specialist', // Teemo
  18: 'marksman', // Tristana
  19: 'diver', // Warwick
  20: 'vanguard', // Nunu & Willump
  21: 'marksman', // Miss Fortune
  22: 'marksman', // Ashe
  23: 'skirmisher', // Tryndamere
  24: 'skirmisher', // Jax
  25: 'catcher', // Morgana
  26: 'specialist', // Zilean
  27: 'specialist', // Singed
  28: 'assassin', // Evelynn
  29: 'marksman', // Twitch
  30: 'battlemage', // Karthus
  31: 'specialist', // Cho'Gath
  32: 'vanguard', // Amumu
  33: 'vanguard', // Rammus
  34: 'battlemage', // Anivia
  35: 'assassin', // Shaco
  36: 'juggernaut', // Dr. Mundo
  37: 'enchanter', // Sona
  38: 'assassin', // Kassadin
  39: 'diver', // Irelia
  40: 'enchanter', // Janna
  41: 'specialist', // Gangplank
  42: 'marksman', // Corki
  43: 'burst,enchanter', // Karma
  44: 'enchanter,warden', // Taric
  45: 'burst', // Veigar
  48: 'juggernaut', // Trundle
  50: 'battlemage', // Swain
  51: 'marksman', // Caitlyn
  53: 'catcher', // Blitzcrank
  54: 'vanguard', // Malphite
  55: 'assassin', // Katarina
  56: 'assassin', // Nocturne
  57: 'vanguard', // Maokai
  58: 'diver', // Renekton
  59: 'diver', // Jarvan IV
  60: 'diver', // Elise
  61: 'burst', // Orianna
  62: 'diver', // Wukong
  63: 'burst', // Brand
  64: 'diver', // Lee Sin
  67: 'marksman', // Vayne
  68: 'battlemage', // Rumble
  69: 'battlemage', // Cassiopeia
  72: 'vanguard,juggernaut', // Skarner
  74: 'specialist', // Heimerdinger
  75: 'juggernaut', // Nasus
  76: 'specialist', // Nidalee
  77: 'juggernaut', // Udyr
  78: 'warden', // Poppy
  79: 'vanguard', // Gragas
  80: 'diver', // Pantheon
  81: 'marksman', // Ezreal
  82: 'juggernaut', // Mordekaiser
  83: 'juggernaut', // Yorick
  84: 'assassin', // Akali
  85: 'specialist', // Kennen
  86: 'juggernaut', // Garen
  89: 'vanguard', // Leona
  90: 'battlemage', // Malzahar
  91: 'assassin', // Talon
  92: 'skirmisher', // Riven
  96: 'marksman', // Kog'Maw
  98: 'warden', // Shen
  99: 'burst,artillery', // Lux
  101: 'artillery', // Xerath
  102: 'diver', // Shyvana
  103: 'burst', // Ahri
  104: 'specialist', // Graves
  105: 'assassin', // Fizz
  106: 'juggernaut', // Volibear
  107: 'assassin,diver', // Rengar
  110: 'marksman,artillery', // Varus
  111: 'vanguard', // Nautilus
  112: 'battlemage', // Viktor
  113: 'vanguard', // Sejuani
  114: 'skirmisher', // Fiora
  115: 'artillery', // Ziggs
  117: 'enchanter', // Lulu
  119: 'marksman', // Draven
  120: 'diver', // Hecarim
  121: 'assassin', // Kha'Zix
  122: 'juggernaut', // Darius
  126: 'artillery', // Jayce
  127: 'burst', // Lissandra
  131: 'assassin,diver', // Diana
  133: 'specialist', // Quinn
  134: 'burst', // Syndra
  136: 'battlemage', // Aurelion Sol
  141: 'skirmisher', // Kayn
  142: 'burst', // Zoe
  143: 'catcher', // Zyra
  145: 'marksman', // Kai'Sa
  147: 'burst,enchanter', // Seraphine
  150: 'specialist', // Gnar
  150: 'vanguard', // Mega Gnar
  154: 'vanguard', // Zac
  157: 'skirmisher', // Yasuo
  161: 'artillery', // Vel'Koz
  163: 'battlemage', // Taliyah
  164: 'diver', // Camille
  166: 'marksman,assassin', // Akshan
  200: 'skirmisher', // Bel'Veth
  201: 'warden', // Braum
  202: 'marksman,catcher', // Jhin
  203: 'marksman', // Kindred
  221: 'marksman', // Zeri
  222: 'marksman', // Jinx
  223: 'warden', // Tahm Kench
  233: 'diver', // Briar
  234: 'skirmisher', // Viego
  235: 'marksman,enchanter', // Senna
  236: 'marksman', // Lucian
  238: 'assassin', // Zed
  240: 'skirmisher', // Kled
  240: 'skirmisher', // Kled & Skaarl
  245: 'assassin', // Ekko
  246: 'assassin', // Qiyana
  254: 'diver', // Vi
  266: 'juggernaut', // Aatrox
  267: 'enchanter', // Nami
  268: 'specialist', // Azir
  350: 'enchanter', // Yuumi
  360: 'marksman', // Samira
  412: 'catcher', // Thresh
  420: 'juggernaut', // Illaoi
  421: 'diver', // Rek'Sai
  427: 'catcher', // Ivern
  429: 'marksman', // Kalista
  432: 'catcher', // Bard
  497: 'catcher', // Rakan
  498: 'marksman', // Xayah
  516: 'vanguard', // Ornn
  517: 'burst,skirmisher', // Sylas
  518: 'burst,catcher', // Neeko
  523: 'marksman', // Aphelios
  526: 'vanguard', // Rell
  555: 'assassin,catcher', // Pyke
  711: 'burst', // Vex
  777: 'assassin,skirmisher', // Yone
  799: 'diver,skirmisher', // Ambessa
  800: 'artillery', // Mel
  804: 'marksman', // Yunara
  805: 'assassin', // Locke
  875: 'juggernaut', // Sett
  876: 'skirmisher', // Lillia
  887: 'skirmisher', // Gwen
  888: 'enchanter', // Renata Glasc
  893: 'burst,assassin', // Aurora
  895: 'skirmisher', // Nilah
  897: 'warden,skirmisher', // K'Sante
  901: 'marksman', // Smolder
  902: 'enchanter', // Milio
  904: 'skirmisher', // Zaahen
  910: 'artillery', // Hwei
  950: 'assassin', // Naafiri
}

/** A champion's subclasses; none for one the snapshot does not know. */
export function subclassesOf(championId: number): SubclassId[] {
  return (SUBCLASSES[championId]?.split(',') ?? []) as SubclassId[]
}

export interface SubclassGroup {
  subclass: SubclassId
  champions: number[]
}

export interface ClassGroup {
  class: ClassDef
  subclasses: SubclassGroup[]
  /** Distinct champions of the class — one that is a diver and a skirmisher counts once. */
  total: number
}

/**
 * The champions grouped by class, then subclass, each in the order `compare`
 * gives (names, in the page). A champion with two subclasses is listed under
 * both; one the snapshot does not know comes back in `unclassified`.
 */
export function groupChampions(
  championIds: number[],
  compare: (a: number, b: number) => number,
): { groups: ClassGroup[], unclassified: number[] } {
  const sorted = [...championIds].sort(compare)
  const groups = CLASSES.map((definition): ClassGroup => {
    const subclasses = definition.subclasses.map(subclass => ({
      subclass,
      champions: sorted.filter(id => subclassesOf(id).includes(subclass)),
    }))
    return { class: definition, subclasses, total: new Set(subclasses.flatMap(group => group.champions)).size }
  })
  return { groups, unclassified: sorted.filter(id => subclassesOf(id).length === 0) }
}
