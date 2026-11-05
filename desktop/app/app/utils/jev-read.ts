import type { JevAnswer, JevQuestion } from '~/utils/jev'

/**
 * What Jev reads, and only that: the meaning of texts — a champion's kit, an
 * item's effects, a rune page, a pair of spells — never a number. TypeSafe's
 * own guidance shapes every question here:
 *
 * - System One models answer "gut-check" judgments, one specific thing per
 *   question, and are not calculators: they "do not compare numeric values
 *   reliably", so win rates, games and win probability stay in code
 *   (`utils/jev-recommend`), out of every state and every question;
 * - a judgment on a scale is a Score whose levels "describe situations, not
 *   degrees", low to high; a yes/no fact is a Noul asked as a question whose
 *   yes is the high value, with what counts as yes and as no spelled out;
 * - the state is an object, each part under a descriptive name, holding only
 *   what its questions need ("accuracy falls as the state grows with content
 *   unrelated to the decision") — so the enemy kits, the items and the lane
 *   are three requests, sent together;
 * - every question a request may need goes in that one request (speculative
 *   fan-out), and the answers are combined in code (composite scoring).
 *
 * A fact does not change within a patch: what was read is kept for the
 * session, and only what is new is asked.
 */

/** A champion's passive and abilities, as Data Dragon words them. */
export interface AbilityText { key: string, name: string, description: string }

export interface ChampionText {
  id: number
  name: string
  /** Riot's classes, first the main one (`Fighter, Tank`). */
  classes: string[]
  kit: AbilityText[]
}

/** What Jev read of an enemy champion's kit, each 0 (none) to 1 (the most). */
export interface ChampionRead {
  cc: number
  heal: number
  burst: number
  autos: number
  tank: number
  /** How sure Jev was over the five, TypeSafe's measure averaged. */
  confidence: number
}

/** What Jev read of an item: four facts (probability of yes) and how well it suits our champion (0–1). */
export interface ItemRead {
  antiHeal: number
  tenacity: number
  antiBurst: number
  vsAutos: number
  vsTanks: number
  kit: number
}

/** How well a lane choice suits our champion against the lane opponent, 0–1, and how sure Jev was. */
export interface FitRead { fit: number, confidence: number }

export interface Request { state: Record<string, unknown>, questions: Record<string, JevQuestion> }

const kitOf = (champion: ChampionText) => ({
  classes: champion.classes.join(', ') || 'unknown',
  abilities: Object.fromEntries(champion.kit.map(ability => [`${ability.key} — ${ability.name}`, ability.description])),
})

const FIT_LEVELS = [
  'Wrong for this champion or for this lane',
  'Workable here, but not what this champion wants against this opponent',
  'Exactly what this champion wants against this lane opponent',
]

/** The enemy champions' facts, as levels of a scale. */
const CHAMPION_SCALES: Record<keyof Omit<ChampionRead, 'confidence'>, { ask: (name: string) => string, levels: string[] }> = {
  cc: {
    ask: name => `How much hard crowd control does ${name} have? Read enemies["${name}"].`,
    levels: [
      'No hard crowd control: at most slows',
      'One hard crowd-control ability on a normal cooldown: a stun, root, knock-up, pull, fear or charm',
      'Several hard crowd-control abilities, or a long or area lockdown: suppression, chained stuns, area knock-ups',
    ],
  },
  heal: {
    ask: name => `How much does ${name} heal? Read enemies["${name}"].`,
    levels: [
      'Little or no healing',
      'Heals itself or allies with one ability or passive',
      'Healing or lifesteal is central to how it wins fights: it out-heals damage in long fights',
    ],
  },
  burst: {
    ask: name => `How quickly can ${name} kill a squishy champion? Read enemies["${name}"].`,
    levels: [
      'Deals its damage over several seconds of fighting',
      'Can bring a squishy champion low with a full combo of abilities',
      'Kills a squishy champion in one quick combo, often from stealth, a dash or out of sight (an assassin)',
    ],
  },
  autos: {
    ask: name => `How much of ${name}'s damage comes from basic attacks? Read enemies["${name}"].`,
    levels: [
      'Deals its damage almost only with abilities',
      'Mixes basic attacks and abilities',
      'Deals most of its damage with basic attacks: on-hit effects, attack speed or critical strikes',
    ],
  },
  tank: {
    ask: name => `How tanky does ${name} play? Read enemies["${name}"]; its classes say how it is usually built.`,
    levels: [
      'Squishy: little health and few resistances',
      'A durable fighter: some health and resistances beside its damage',
      'A tank: builds mostly health and resistances to soak damage at the front',
    ],
  },
}

/** The enemy kits as one request: five scales per champion. */
export function enemyRequest(enemies: ChampionText[]): Request {
  const questions: Record<string, JevQuestion> = {}
  for (const enemy of enemies) {
    for (const [fact, scale] of Object.entries(CHAMPION_SCALES)) {
      questions[`e${enemy.id}_${fact}`] = { type: 'score', instructions: scale.ask(enemy.name), criteria: scale.levels }
    }
  }
  return { state: { enemies: Object.fromEntries(enemies.map(enemy => [enemy.name, kitOf(enemy)])) }, questions }
}

/** The items' facts, each a yes/no statement about one item. */
const ITEM_FACTS: Record<keyof Omit<ItemRead, 'kit'>, { says: (name: string) => string, yes: string, no: string }> = {
  antiHeal: {
    says: name => `Does items["${name}"] apply Grievous Wounds to the enemies it damages, cutting their healing?`,
    yes: 'Its text mentions Grievous Wounds or reduced healing on enemies',
    no: 'Nothing in it reduces enemy healing',
  },
  tenacity: {
    says: name => `Does items["${name}"] give its holder Tenacity, or remove or shorten crowd control on it?`,
    yes: 'Its text gives Tenacity, or cleanses or shortens crowd control',
    no: 'It does nothing against crowd control',
  },
  antiBurst: {
    says: name => `Does items["${name}"] protect its holder from burst with a shield, a stasis, a spell shield, or a lifeline that triggers at low health?`,
    yes: 'Its text gives such a shield, stasis, spell shield or low-health lifeline',
    no: 'It has no such protection',
  },
  vsAutos: {
    says: name => `Does items["${name}"] counter basic attacks — slowing attackers' attack speed, reducing critical-strike damage taken, or reflecting damage to attackers?`,
    yes: 'Its text does one of those against attackers',
    no: 'It does nothing special against basic attacks',
  },
  vsTanks: {
    says: name => `Does items["${name}"] help its holder kill tanks with armor or magic penetration, or damage based on the target's maximum health?`,
    yes: 'Its text gives penetration or maximum-health damage',
    no: 'It has neither',
  },
}

/** The candidate items as one request: four facts each, and how well each suits our champion's kit. */
export function itemRequest(champion: ChampionText, position: string, items: { id: number, name: string, text: string }[]): Request {
  const questions: Record<string, JevQuestion> = {}
  for (const item of items) {
    for (const [fact, statement] of Object.entries(ITEM_FACTS)) {
      questions[`i${item.id}_${fact}`] = { type: 'noul', instructions: statement.says(item.name), criteria: { true: statement.yes, false: statement.no } }
    }
    questions[`i${item.id}_kit`] = {
      type: 'score',
      instructions: `How well does items["${item.name}"] suit ourChampion, given its abilities and role?`,
      criteria: [
        'Its stats and effects do nothing for this champion\'s abilities',
        'Usable on this champion, but not what its abilities scale with',
        'Gives what this champion\'s abilities scale with and need',
      ],
    }
  }
  return {
    state: {
      ourChampion: { name: champion.name, role: position, ...kitOf(champion) },
      items: Object.fromEntries(items.map(item => [item.name, item.text])),
    },
    questions,
  }
}

/** The lane choices as one request: each rune page, spell pair and starter against the lane opponent, and how soon boots are needed. */
export function laneRequest(input: {
  champion: ChampionText
  position: string
  opponent: ChampionText | null
  runePages: { key: string, text: string }[]
  spells: { key: string, text: string }[]
  starters: { key: string, text: string }[]
}): Request {
  const against = input.opponent ? 'laneOpponent' : 'an unknown lane opponent'
  const questions: Record<string, JevQuestion> = {}
  for (const page of input.runePages) {
    questions[`r_${page.key}`] = { type: 'score', instructions: `How well does runePages["${page.key}"] suit ourChampion laning against ${against}?`, criteria: FIT_LEVELS }
  }
  for (const spells of input.spells) {
    questions[`s_${spells.key}`] = { type: 'score', instructions: `How well do spells["${spells.key}"] suit ourChampion laning against ${against}?`, criteria: FIT_LEVELS }
  }
  for (const starter of input.starters) {
    questions[`st_${starter.key}`] = { type: 'score', instructions: `How well do starters["${starter.key}"] suit ourChampion's first levels against ${against}?`, criteria: FIT_LEVELS }
  }
  questions.bootsTiming = {
    type: 'score',
    instructions: `How soon does ourChampion need boots in the lane against ${against}?`,
    criteria: [
      'It can finish its first item before boots: the lane does not punish it for moving slowly',
      'It wants boots right after its first item',
      'It needs boots before its first item: the opponent kites, pokes or out-ranges it, or the lane needs the defense now',
    ],
  }
  return {
    state: {
      ourChampion: { name: input.champion.name, role: input.position, ...kitOf(input.champion) },
      ...(input.opponent ? { laneOpponent: { name: input.opponent.name, ...kitOf(input.opponent) } } : {}),
      runePages: Object.fromEntries(input.runePages.map(page => [page.key, page.text])),
      spells: Object.fromEntries(input.spells.map(spells => [spells.key, spells.text])),
      starters: Object.fromEntries(input.starters.map(starter => [starter.key, starter.text])),
    },
    questions,
  }
}

/** What Jev read of a champion we could pick, each 0 (bad) to 1 (good); null where the draft gave nothing to judge against. */
export interface PickRead {
  lane: number | null
  team: number | null
  enemy: number | null
  confidence: number
}

const PICK_SCALES = {
  lane: {
    ask: (name: string) => `How does candidates["${name}"] fare laning against laneOpponent?`,
    levels: [
      'laneOpponent wins the lane: its kit punishes this champion in lane',
      'An even lane: neither kit has the edge',
      'This champion wins the lane: its kit punishes laneOpponent',
    ],
  },
  team: {
    ask: (name: string) => `How well does candidates["${name}"] complete ourTeam?`,
    levels: [
      'Doubles what ourTeam already has and leaves its gaps open',
      'Fits ourTeam without filling a gap',
      'Gives ourTeam what it lacks: a frontline, engage, the other damage type, or the range it misses',
    ],
  },
  enemy: {
    ask: (name: string) => `How does candidates["${name}"] fare against enemyTeam as a whole?`,
    levels: [
      'enemyTeam shuts it down: its crowd control, burst or range beats this champion',
      'Neither side has the edge',
      'This champion punishes what enemyTeam relies on',
    ],
  },
} as const

/**
 * The champions we could pick as one request: against the lane opponent, with
 * our team, against the enemy team — each a scale of situations, asked only
 * where the draft has someone to judge against. Short kits: many champions
 * share the state, and only what they do matters here.
 */
export function pickRequest(input: {
  position: string
  opponent: ChampionText | null
  allies: ChampionText[]
  enemies: ChampionText[]
  candidates: ChampionText[]
}): Request {
  const asked = (Object.keys(PICK_SCALES) as (keyof typeof PICK_SCALES)[]).filter(fact => (fact === 'lane' ? !!input.opponent : fact === 'team' ? input.allies.length > 0 : input.enemies.length > 0))
  const questions: Record<string, JevQuestion> = {}
  for (const candidate of input.candidates) {
    for (const fact of asked) questions[`p${candidate.id}_${fact}`] = { type: 'score', instructions: PICK_SCALES[fact].ask(candidate.name), criteria: [...PICK_SCALES[fact].levels] }
  }
  return {
    state: {
      ourRole: input.position,
      ...(input.opponent ? { laneOpponent: { name: input.opponent.name, ...kitOf(input.opponent) } } : {}),
      ourTeam: Object.fromEntries(input.allies.map(ally => [ally.name, kitOf(ally)])),
      enemyTeam: Object.fromEntries(input.enemies.map(enemy => [enemy.name, kitOf(enemy)])),
      candidates: Object.fromEntries(input.candidates.map(candidate => [candidate.name, kitOf(candidate)])),
    },
    questions,
  }
}

export function readPick(id: number, answers: Record<string, JevAnswer>): PickRead | null {
  const reads = (Object.keys(PICK_SCALES) as (keyof typeof PICK_SCALES)[]).map(fact => [fact, scoreOf(answers[`p${id}_${fact}`])] as const)
  const known = reads.filter(([, read]) => read)
  if (!known.length) return null
  const value = (fact: keyof typeof PICK_SCALES) => reads.find(([name]) => name === fact)?.[1]?.value ?? null
  return { lane: value('lane'), team: value('team'), enemy: value('enemy'), confidence: known.reduce((sum, [, read]) => sum + read!.confidence, 0) / known.length }
}

/**
 * A Score answer on 0–1 (its expected level over the top one), with its
 * confidence; null when it did not come back. An answer spread over the
 * levels — low confidence, in TypeSafe's terms — is pulled toward the middle
 * as far as it is spread: Jev unsure is not Jev saying "some".
 */
export function scoreOf(answer: JevAnswer | undefined, levels = 3): { value: number, confidence: number } | null {
  if (!answer || answer.type !== 'score') return null
  const raw = Math.min(1, Math.max(0, answer.score / (levels - 1)))
  const trust = 0.4 + 0.6 * Math.min(1, Math.max(0, answer.confidence))
  return { value: 0.5 + (raw - 0.5) * trust, confidence: answer.confidence }
}

/** A Noul answer: the probability of yes; null when it did not come back. */
export function noulOf(answer: JevAnswer | undefined): number | null {
  return answer && answer.type === 'noul' ? answer.noul : null
}

export function readChampion(id: number, answers: Record<string, JevAnswer>): ChampionRead | null {
  const facts = (Object.keys(CHAMPION_SCALES) as (keyof typeof CHAMPION_SCALES)[]).map(fact => [fact, scoreOf(answers[`e${id}_${fact}`])] as const)
  if (facts.some(([, read]) => !read)) return null
  const read = Object.fromEntries(facts.map(([fact, value]) => [fact, value!.value])) as Omit<ChampionRead, 'confidence'>
  return { ...read, confidence: facts.reduce((sum, [, value]) => sum + value!.confidence, 0) / facts.length }
}

export function readItem(id: number, answers: Record<string, JevAnswer>): ItemRead | null {
  const fact = (name: string) => noulOf(answers[`i${id}_${name}`])
  const kit = scoreOf(answers[`i${id}_kit`])
  const facts = { antiHeal: fact('antiHeal'), tenacity: fact('tenacity'), antiBurst: fact('antiBurst'), vsAutos: fact('vsAutos'), vsTanks: fact('vsTanks') }
  if (!kit || Object.values(facts).some(value => value === null)) return null
  return { ...(facts as Omit<ItemRead, 'kit'>), kit: kit.value }
}

/** Requests split so none carries more than `size` questions; each part keeps the whole state. */
export function batches(request: Request, size = 150): Request[] {
  const entries = Object.entries(request.questions)
  if (entries.length <= size) return entries.length ? [request] : []
  const parts: Request[] = []
  for (let start = 0; start < entries.length; start += size) parts.push({ state: request.state, questions: Object.fromEntries(entries.slice(start, start + size)) })
  return parts
}

/** What was read this session, by patch and subject: a fact does not change within a patch. */
const championReads = new Map<string, ChampionRead>()
const itemReads = new Map<string, ItemRead>()

export const championReadKey = (patch: string, id: number) => `${patch}:${id}`
export const itemReadKey = (patch: string, championId: number, position: string, itemId: number) => `${patch}:${championId}:${position}:${itemId}`

export const knownChampionRead = (key: string) => championReads.get(key)
export const knownItemRead = (key: string) => itemReads.get(key)
export const keepChampionRead = (key: string, read: ChampionRead) => void championReads.set(key, read)
export const keepItemRead = (key: string, read: ItemRead) => void itemReads.set(key, read)
