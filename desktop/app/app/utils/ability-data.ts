import type { ChampionStaticData } from '#shared/types/static-data'
import { championTraits } from '~/utils/sources/champions'
/**
 * A champion's abilities with every figure the game shows, read from
 * CommunityDragon's `latest` — extracted from the game client on each patch,
 * so it follows the live game with no update here: the client's own
 * description in the player's language (`rcp-be-lol-game-data`, its
 * `@Placeholders@` included) and the champion's game file
 * (`characters/<alias>/<alias>.bin.json`), whose data values and calculations
 * the placeholders name. The calculations are resolved the way the game's
 * tooltips are — per rank, base value and each scaling with its stat — and
 * written into the text: `35/60/85/110/135 (+60% DdA adicional)`.
 */

const CDRAGON = 'https://raw.communitydragon.org/latest'

/** A figure per rank, and what it scales with. */
export interface Scaling { stat: number, formula: number, coefficient: number[] }
export interface Figure {
  /** The flat part per rank (index 0 is rank 1). */
  base: number[]
  scalings: Scaling[]
  /** A value set by champion level instead of rank: its level-1 and level-18 values. */
  byLevel?: [number, number]
  percent: boolean
}

export interface AbilityData {
  key: 'P' | 'Q' | 'W' | 'E' | 'R'
  name: string
  /** The client's description with every placeholder resolved, as safe HTML (the game's own tags as classed spans). */
  html: string
  cooldown: number[]
  cost: number[]
  range: number[]
  maxRank: number
  /** Charges: how many and how fast one returns, per rank; null for a spell without them. */
  ammo: { max: number[], recharge: number[] } | null
  /** The resource it spends (`Mana`, `Energia`…), from the client's cost line. */
  resource: string | null
}

// The game file is untyped JSON, read field by field.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = Record<string, any>

// ─── Calculations ───────────────────────────────────────────────────────────

const ranks = (values: number[] | undefined, count: number): number[] =>
  Array.from({ length: count }, (_, index) => values?.[index + 1] ?? values?.[values.length - 1] ?? 0)

const constant = (value: number, count: number): Figure => ({ base: Array.from({ length: count }, () => value), scalings: [], percent: false })
const scale = (figure: Figure, by: number[]): Figure => ({
  base: figure.base.map((value, index) => value * (by[index] ?? by[0] ?? 1)),
  scalings: figure.scalings.map(entry => ({ ...entry, coefficient: entry.coefficient.map((value, index) => value * (by[index] ?? by[0] ?? 1)) })),
  byLevel: figure.byLevel ? [figure.byLevel[0] * (by[0] ?? 1), figure.byLevel[1] * (by[0] ?? 1)] : undefined,
  percent: figure.percent,
})
const add = (a: Figure, b: Figure): Figure => ({
  base: a.base.map((value, index) => value + (b.base[index] ?? 0)),
  scalings: [...a.scalings, ...b.scalings],
  byLevel: a.byLevel && b.byLevel ? [a.byLevel[0] + b.byLevel[0], a.byLevel[1] + b.byLevel[1]] : a.byLevel ?? b.byLevel,
  percent: a.percent || b.percent,
})
const isFlat = (figure: Figure) => figure.scalings.length === 0 && !figure.byLevel

/** A value set by champion level: its level-1 and level-18 values, breakpoints included. */
function byLevel(part: Obj): [number, number] {
  if (part.__type === 'ByCharLevelInterpolationCalculationPart') return [part.mStartValue ?? 0, part.mEndValue ?? 0]
  let value = part.mLevel1Value ?? 0
  let step = part.mInitialBonusPerLevel ?? 0
  const breakpoints: Obj[] = part.mBreakpoints ?? []
  for (let level = 2; level <= 18; level++) {
    const at = breakpoints.find(point => point.mLevel === level)
    if (at) {
      if (at.mAdditionalBonusAtThisLevel) value += at.mAdditionalBonusAtThisLevel
      if (at.mBonusPerLevelAtAndAfter !== undefined) step = at.mBonusPerLevelAtAndAfter
      else if (at.mAdditionalBonusAtThisLevel === undefined && !('mBonusPerLevelAtAndAfter' in at)) step = 0
    }
    value += step
  }
  return [part.mLevel1Value ?? 0, value]
}

export function resolvePart(part: Obj | undefined, values: Map<string, number[]>, calcs: Obj, count: number, depth = 0): Figure | null {
  if (!part || depth > 12) return null
  // The game file's names and the calculations' do not always agree on case.
  const named = (name: string | undefined) => {
    if (!name) return null
    const found = values.has(name) ? name : [...values.keys()].find(key => key.toLowerCase() === name.toLowerCase())
    return found ? ranks(values.get(found), count) : null
  }
  switch (part.__type) {
    case 'NamedDataValueCalculationPart': {
      const value = named(part.mDataValue)
      return value ? { base: value, scalings: [], percent: false } : null
    }
    case 'NumberCalculationPart':
      return constant(part.mNumber ?? 0, count)
    case 'StatByNamedDataValueCalculationPart': {
      const value = named(part.mDataValue)
      return value ? { base: value.map(() => 0), scalings: [{ stat: part.mStat ?? 0, formula: part.mStatFormula ?? 0, coefficient: value }], percent: false } : null
    }
    case 'StatByCoefficientCalculationPart':
      return { base: Array.from({ length: count }, () => 0), scalings: [{ stat: part.mStat ?? 0, formula: part.mStatFormula ?? 0, coefficient: Array.from({ length: count }, () => part.mCoefficient ?? 0) }], percent: false }
    case 'StatBySubPartCalculationPart': {
      const sub = resolvePart(part.mSubpart, values, calcs, count, depth + 1)
      return sub && isFlat(sub) ? { base: sub.base.map(() => 0), scalings: [{ stat: part.mStat ?? 0, formula: part.mStatFormula ?? 0, coefficient: sub.base }], percent: false } : null
    }
    case 'SumOfSubPartsCalculationPart': {
      const parts = (part.mSubparts ?? []).map((sub: Obj) => resolvePart(sub, values, calcs, count, depth + 1))
      return parts.includes(null) ? null : parts.reduce((sum: Figure, next: Figure) => add(sum, next), constant(0, count))
    }
    case 'ProductOfSubPartsCalculationPart': {
      const a = resolvePart(part.mPart1, values, calcs, count, depth + 1)
      const b = resolvePart(part.mPart2, values, calcs, count, depth + 1)
      if (!a || !b) return null
      if (isFlat(b)) return scale(a, b.base)
      if (isFlat(a)) return scale(b, a.base)
      return null
    }
    case 'ByCharLevelInterpolationCalculationPart':
    case 'ByCharLevelBreakpointsCalculationPart':
      return { base: Array.from({ length: count }, () => 0), scalings: [], byLevel: byLevel(part), percent: false }
    // So much per stack of a buff the ability counts (Garen's kills, Veigar's Phenomenal Evil): a pseudo-stat, read as "per stack".
    case 'BuffCounterByNamedDataValueCalculationPart': {
      const value = named(part.mDataValue)
      return value ? { base: value.map(() => 0), scalings: [{ stat: STACKS, formula: 0, coefficient: value }], percent: false } : null
    }
    case 'BuffCounterByCoefficientCalculationPart':
      return { base: Array.from({ length: count }, () => 0), scalings: [{ stat: STACKS, formula: 0, coefficient: Array.from({ length: count }, () => part.mCoefficient ?? 0) }], percent: false }
    // A ratio of the champion's resource (mana, energy): another pseudo-stat.
    case 'AbilityResourceByCoefficientCalculationPart':
      return { base: Array.from({ length: count }, () => 0), scalings: [{ stat: RESOURCE, formula: part.mStatFormula ?? 0, coefficient: Array.from({ length: count }, () => part.mCoefficient ?? 0) }], percent: false }
    // A sum held between a floor and a ceiling: the sum is what the tooltip shows.
    case 'ClampSubPartsCalculationPart': {
      const parts = (part.mSubparts ?? []).map((sub: Obj) => resolvePart(sub, values, calcs, count, depth + 1))
      return parts.includes(null) ? null : parts.reduce((sum: Figure, next: Figure) => add(sum, next), constant(0, count))
    }
    // A value per champion level, listed: its first and its last.
    case 'ByCharLevelFormulaCalculationPart': {
      const list: number[] = part.mValues ?? []
      return list.length ? { base: Array.from({ length: count }, () => 0), scalings: [], byLevel: [list[1] ?? list[0]!, list[18] ?? list[list.length - 1]!], percent: false } : null
    }
    // The ability's cooldown scales it: the tooltip shows the value itself.
    case 'CooldownMultiplierCalculationPart':
      return constant(1, count)
    case 'EffectValueCalculationPart': {
      const value = named(`Effect${(part.mEffectIndex ?? 0)}Amount`)
      return value ? { base: value, scalings: [], percent: false } : null
    }
    case 'GameCalculationModified':
    case 'GameCalculation':
      return resolveCalculation(part, values, calcs, count, depth + 1)
    default:
      if (part.mSpellCalculationKey) return resolveCalculation(calcs[part.mSpellCalculationKey], values, calcs, count, depth + 1)
      return null
  }
}

export function resolveCalculation(calc: Obj | undefined, values: Map<string, number[]>, calcs: Obj, count: number, depth = 0): Figure | null {
  if (!calc || depth > 12) return null
  if (calc.__type === 'GameCalculationModified') {
    const inner = resolveCalculation(calcs[calc.mModifiedGameCalculation], values, calcs, count, depth + 1)
    const by = resolvePart(calc.mMultiplier, values, calcs, count, depth + 1)
    if (!inner || !by || !isFlat(by)) return inner
    return { ...scale(inner, by.base), percent: inner.percent }
  }
  const parts = (calc.mFormulaParts ?? []).map((part: Obj) => resolvePart(part, values, calcs, count, depth + 1))
  if (!parts.length || parts.includes(null)) return null
  const sum = parts.reduce((total: Figure, next: Figure) => add(total, next), constant(0, count))
  let figure: Figure = { ...sum, percent: Boolean(calc.mDisplayAsPercent) }
  if (calc.mMultiplier) {
    const by = resolvePart(calc.mMultiplier, values, calcs, count, depth + 1)
    if (by && isFlat(by)) figure = { ...scale(figure, by.base), percent: figure.percent }
  }
  return figure
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/** Pseudo-stats: a buff's stacks, the champion's resource. */
const STACKS = -1
const RESOURCE = -2

/** The game's stats by id, as tooltips name them. */
const STATS_PT: Record<number, string> = { [STACKS]: 'por acúmulo', [RESOURCE]: 'Mana máxima', 0: 'PdH', 1: 'Armadura', 2: 'DdA', 3: 'Velocidade de Ataque', 5: 'Resistência Mágica', 6: 'Velocidade de Movimento', 7: 'Chance de Acerto Crítico', 8: 'Dano Crítico', 10: 'Aceleração de Habilidade', 11: 'Vida máxima', 12: 'Vida atual', 13: 'Vida perdida', 15: 'Roubo de Vida', 28: 'Alcance de Ataque', 29: 'Regeneração de Vida' }
const STATS_EN: Record<number, string> = { [STACKS]: 'per stack', [RESOURCE]: 'max Mana', 0: 'AP', 1: 'Armor', 2: 'AD', 3: 'Attack Speed', 5: 'Magic Resist', 6: 'Move Speed', 7: 'Crit Chance', 8: 'Crit Damage', 10: 'Ability Haste', 11: 'max Health', 12: 'current Health', 13: 'missing Health', 15: 'Life Steal', 28: 'Attack Range', 29: 'Health Regen' }

const number = (value: number) => String(Math.round(value * 100) / 100)
/** A figure per rank: one number when every rank agrees, else them all, slashed. */
export const perRank = (values: number[], multiplier = 1) => {
  const shown = values.map(value => number(value * multiplier))
  return shown.every(value => value === shown[0]) ? shown[0]! : shown.join('/')
}

export function formatFigure(figure: Figure, locale: 'pt' | 'en', multiplier = 1): string {
  const pct = figure.percent ? 100 : 1
  const m = multiplier * pct
  const suffix = figure.percent || multiplier === 100 ? '%' : ''
  const parts: string[] = []
  if (figure.byLevel) {
    parts.push(`${number(figure.byLevel[0] * m)}–${number(figure.byLevel[1] * m)}${suffix} ${locale === 'pt' ? '(com base no nível)' : '(based on level)'}`)
  }
  if (!figure.byLevel || figure.base.some(value => value !== 0)) {
    if (figure.base.some(value => value !== 0) || figure.scalings.length === 0) parts.push(`${perRank(figure.base, m)}${suffix}`)
  }
  const names = locale === 'pt' ? STATS_PT : STATS_EN
  for (const entry of figure.scalings) {
    const stat = names[entry.stat] ?? (locale === 'pt' ? 'atributo' : 'stat')
    const kind = entry.formula === 2 ? (locale === 'pt' ? ' adicional' : ' bonus') : entry.formula === 1 ? (locale === 'pt' ? ' base' : ' base') : ''
    // A percentage that grows with a stat reads per hundred of it, as the game's tooltips write it: `(+2.5% por 100 de DdA adicional)`.
    if (figure.percent) {
      const ratio = perRank(entry.coefficient, 100 * 100 * multiplier)
      parts.push(locale === 'pt' ? `(+${ratio}% por 100 de ${stat}${kind})` : `(+${ratio}% per 100${kind} ${stat})`)
      continue
    }
    if (entry.stat === STACKS) {
      parts.push(`(+${perRank(entry.coefficient, multiplier)} ${stat})`)
      continue
    }
    const ratio = perRank(entry.coefficient, 100 * multiplier)
    parts.push(locale === 'pt' ? `(+${ratio}% ${stat}${kind})` : `(+${ratio}%${kind} ${stat})`)
  }
  return parts.join(' ')
}

// ─── Text ───────────────────────────────────────────────────────────────────

/** The game's description tags that carry meaning, as the classes the view colours them with. */
const TAGS: Record<string, string> = {
  physicaldamage: 'ab-physical', magicdamage: 'ab-magic', truedamage: 'ab-true', healing: 'ab-heal', shield: 'ab-shield',
  status: 'ab-status', speed: 'ab-speed', recast: 'ab-recast', keywordmajor: 'ab-keyword', keywordstealth: 'ab-keyword',
  attention: 'ab-attention', scalead: 'ab-ad', scaleap: 'ab-ap', scalehealth: 'ab-health', scalearmor: 'ab-armor', scalemr: 'ab-mr',
  spellname: 'ab-spellname', passive: 'ab-keyword', active: 'ab-keyword', rules: 'ab-rules', lifesteal: 'ab-heal', onhit: 'ab-keyword',
}
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The description as safe HTML: text escaped, the game's tags as classed spans, line breaks kept, anything else dropped. */
export function safeDescription(source: string): string {
  let out = ''
  const open: string[] = []
  for (const token of source.split(/(<[^>]+>)/g)) {
    const tag = token.match(/^<\s*(\/)?\s*([a-z0-9]+)[^>]*>$/i)
    if (!tag) {
      out += escape(token)
      continue
    }
    const [, closing, raw] = tag
    const name = raw!.toLowerCase()
    if (name === 'br') {
      out += '<br>'
      continue
    }
    const cls = TAGS[name]
    if (!cls) continue
    if (closing) {
      if (open.includes(name)) {
        out += '</span>'
        open.splice(open.lastIndexOf(name), 1)
      }
    }
    else {
      out += `<span class="${cls}">`
      open.push(name)
    }
  }
  return out + '</span>'.repeat(open.length)
}

/** `@Name@`, `@Name*100@`, `@Name*-100@`: a placeholder and the factor it is shown at. */
const PLACEHOLDER = /@([A-Za-z0-9_.:]+)(?:\*(-?[\d.]+))?@/g

/** Another spell's values and calculations, by its script name (`spell.ZyraP:PlantDamage`). */
export type SpellLookup = (scriptName: string) => { values: Map<string, number[]>, calcs: Obj } | null

export function fillDescription(source: string, values: Map<string, number[]>, calcs: Obj, count: number, locale: 'pt' | 'en', other?: SpellLookup): string {
  // `%i:scaleArmor%`: the game's inline stat icons; `{{ Spell_X_Mod }}`: references to the game's own strings. A text has no use for either.
  const text = source.replace(/%i:[A-Za-z0-9_]+%/g, '').replace(/\{\{[^}]*\}\}/g, '')
  // Lower-cased lookups: the client's text and the game file do not always agree on the case.
  const valueKey = new Map([...values.keys()].map(key => [key.toLowerCase(), key]))
  const calcKey = new Map(Object.keys(calcs).map(key => [key.toLowerCase(), key]))
  return text.replace(PLACEHOLDER, (_whole, name: string, factor?: string) => {
    const multiplier = factor ? Number(factor) : 1
    // A value of another spell of the champion's.
    const reference = name.match(/^spell\.([^:]+):(.+)$/i)
    if (reference) {
      const spell = other?.(reference[1]!)
      return spell ? fillDescription(`@${reference[2]}${factor ? `*${factor}` : ''}@`, spell.values, spell.calcs, count, locale) : '—'
    }
    const lower = name.toLowerCase()
    if (lower === 'spellmodifierdescriptionappend' || lower.startsWith('spellmodifier')) return ''
    const calc = calcKey.get(lower)
    if (calc) {
      const figure = resolveCalculation(calcs[calc], values, calcs, count)
      if (figure) return formatFigure(figure, locale, Math.abs(multiplier) === 1 ? 1 : Math.abs(multiplier) === 100 ? 100 : Math.abs(multiplier))
    }
    const value = valueKey.get(lower)
    if (value) return perRank(ranks(values.get(value), count), Math.abs(multiplier))
    // A value the game only works out in play (`@f1@`: hits by attack speed, a script's figure): said as unknown, not made up.
    return '—'
  })
}

// ─── Reading ────────────────────────────────────────────────────────────────

/**
 * The abilities as Data Dragon's champion file has them (`championStatic`):
 * Q, W, E and R with their description, cooldown, cost and range per rank, no
 * passive — what is shown at once, the clips with them, while Community
 * Dragon's game data, whose figures fill the descriptions, is read (on
 * 2026-11-13 it answered every file in 20 s).
 */
export function quickAbilities(statics: ChampionStaticData | null | undefined): AbilityData[] {
  if (!statics) return []
  const numbers = (burn?: string) => (burn ?? '').split('/').map(Number).filter(value => Number.isFinite(value))
  return (['Q', 'W', 'E', 'R'] as const).flatMap((key): AbilityData[] => {
    const spell = statics.championSpells[key]
    if (!spell) return []
    const cooldown = numbers(spell.cooldownBurn)
    const cost = numbers(spell.costBurn)
    return [{
      key,
      name: spell.name,
      html: safeDescription(spell.description ?? ''),
      cooldown,
      cost,
      range: numbers(spell.rangeBurn),
      maxRank: Math.max(cooldown.length, 1),
      ammo: null,
      resource: cost.some(value => value > 0) ? statics.partype : null,
    }]
  })
}

const reads = new Map<string, Promise<AbilityData[]>>()

/** The champion's abilities in the player's language (`pt_br`, else the client's English). */
export function readAbilities(championId: number, locale: 'pt' | 'en'): Promise<AbilityData[]> {
  const key = `${championId}:${locale}`
  let read = reads.get(key)
  if (!read) {
    read = load(championId, locale)
    read.catch(() => reads.delete(key))
    reads.set(key, read)
  }
  return read
}

async function load(championId: number, locale: 'pt' | 'en'): Promise<AbilityData[]> {
  const lang = locale === 'pt' ? 'pt_br' : 'default'
  // Both files at once: the champion's alias is known from Data Dragon's roster, so the game file need not wait for the client's.
  const known = (await championTraits().catch(() => null))?.get(championId)?.alias?.toLowerCase() ?? null
  const clientRead = $fetch<Obj>(`${CDRAGON}/plugins/rcp-be-lol-game-data/global/${lang}/v1/champions/${championId}.json`)
  const binOf = (alias: string) => $fetch<Obj>(`${CDRAGON}/game/data/characters/${alias}/${alias}.bin.json`).catch(() => ({} as Obj))
  const [client, early] = await Promise.all([clientRead, known ? binOf(known) : Promise.resolve(null)])
  const alias = String(client.alias ?? '').toLowerCase()
  const bin = early && known === alias ? early : await binOf(alias)
  const root = Object.entries(bin).find(([path]) => path.toLowerCase().endsWith('characterrecords/root'))?.[1] as Obj | undefined
  const spellPath = (name: string) => Object.keys(bin).find(path => path.toLowerCase() === `characters/${alias}/spells/${name.toLowerCase()}`)
  const spellOf = (name: string | undefined) => {
    if (!name) return null
    const path = name.includes('/') && name.toLowerCase().startsWith('characters/') ? name : spellPath(name)
    return (path ? (bin[path] as Obj | undefined)?.mSpell : null) ?? null
  }

  // Every spell object of the champion: a description often names values its sub-spells hold (a card, a form, a recast).
  const allSpells = Object.values(bin).map(entry => (entry as Obj)?.mSpell).filter(Boolean) as Obj[]
  const valuesOf = (spell: Obj | null | undefined) => {
    const map = new Map<string, number[]>()
    for (const entry of (spell?.DataValues ?? spell?.mDataValues ?? []) as Obj[]) map.set(String(entry.name ?? entry.mName), entry.values ?? entry.mValues ?? [])
    // The older form: effect amounts by index, named as the descriptions name them.
    for (const [index, entry] of ((spell?.mEffectAmount ?? []) as Obj[]).entries()) {
      if (entry?.value?.some((value: number) => value !== 0)) map.set(`Effect${index + 1}Amount`, entry.value)
    }
    return map
  }
  const shared = { values: new Map<string, number[]>(), calcs: {} as Obj }
  for (const spell of allSpells) {
    for (const [name, value] of valuesOf(spell)) if (!shared.values.has(name)) shared.values.set(name, value)
    for (const [name, calc] of Object.entries((spell.mSpellCalculations ?? {}) as Obj)) if (!(name in shared.calcs)) shared.calcs[name] = calc
  }

  const byScript = new Map(Object.values(bin).filter(entry => (entry as Obj)?.mScriptName).map(entry => [String((entry as Obj).mScriptName).toLowerCase(), (entry as Obj).mSpell as Obj]))
  const other: SpellLookup = (scriptName) => {
    const spell = byScript.get(scriptName.toLowerCase())
    return spell ? { values: new Map([...shared.values, ...valuesOf(spell)]), calcs: { ...shared.calcs, ...(spell.mSpellCalculations ?? {}) } } : null
  }

  const abilities: AbilityData[] = []
  const build = (key: AbilityData['key'], text: string, name: string, spell: Obj | null, extra: { cooldown: number[], cost: number[], range: number[], maxRank: number, ammo: AbilityData['ammo'], resource: string | null }) => {
    // The client's own figures, named as descriptions name them; rank 0 first, as the game file's values have it.
    const client = new Map<string, number[]>([
      ['Cooldown', [0, ...extra.cooldown]],
      ['Cost', [0, ...extra.cost]],
      ...(extra.ammo ? [['MaxAmmo', [0, ...extra.ammo.max]], ['AmmoRechargeTime', [0, ...extra.ammo.recharge]], ['ChargeCooldown', [0, ...extra.ammo.recharge]]] as [string, number[]][] : []),
    ])
    // The ability's own values first, its sub-spells' after.
    const values = new Map([...client, ...shared.values, ...valuesOf(spell)])
    const calcs = { ...shared.calcs, ...((spell?.mSpellCalculations ?? {}) as Obj) }
    abilities.push({ key, name, html: safeDescription(fillDescription(text, values, calcs, Math.max(1, extra.maxRank), locale, other)), ...extra })
  }

  const passive = client.passive as Obj | undefined
  if (passive) {
    const spell = spellOf(root?.mCharacterPassiveSpell)
    build('P', passive.dynamicDescription || passive.description || '', passive.name ?? '', spell, { cooldown: [], cost: [], range: [], maxRank: 1, ammo: null, resource: null })
  }
  const names: string[] = root?.spellNames ?? []
  for (const [index, entry] of ((client.spells ?? []) as Obj[]).entries()) {
    const key = (['Q', 'W', 'E', 'R'] as const)[index]!
    const max = entry.maxLevel || (key === 'R' ? 3 : 5)
    const name = names[index]?.split('/').pop()
    const spell = spellOf(names[index] ? `Characters/${client.alias}/Spells/${names[index]}` : undefined) ?? spellOf(name)
    const ammo = entry.ammo?.maxAmmo?.some((value: number) => value > 0) ? { max: (entry.ammo.maxAmmo as number[]).slice(0, max), recharge: (entry.ammo.ammoRechargeTime as number[]).slice(0, max) } : null
    const costLine = String(entry.cost ?? '')
    const resource = /@AbilityResourceName@/.test(costLine) ? (client.spells?.[index]?.costType ?? null) : costLine.replace(/@[^@]+@/g, '').replace(/%[^%]+%/g, '').trim() || null
    build(key, entry.dynamicDescription || entry.description || '', entry.name ?? '', spell, {
      cooldown: (entry.cooldownCoefficients ?? []).slice(0, max),
      cost: (entry.costCoefficients ?? []).slice(0, max),
      range: (entry.range ?? []).slice(0, max),
      maxRank: max,
      ammo,
      resource,
    })
  }
  return abilities
}
