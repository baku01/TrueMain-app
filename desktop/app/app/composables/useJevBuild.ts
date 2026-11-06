import type { CompositionBuildRequest } from '~/types/build'
import type { JevAnswer } from '~/utils/jev'
import type { LaidBuild, Names } from '~/utils/jev-build'
import type { FitRead, ItemRead, Request } from '~/utils/jev-read'
import type { Needs, RankedSlot } from '~/utils/jev-recommend'
import type { JevBase, LoadedBase } from '~/utils/jev-bases'
import { askJev, jevKeyStatus } from '~/utils/jev'
import type { SlotStats } from '~/utils/jev-item-stats'
import { INVENTORY, candidateItems, closestCore, coreSlots, damageKind, firstSlots, itemEffect, laidBuild, laterSlot, laterSlotNumbers, measuredPool, plainAbility, roomFor, standardCore, statsPool } from '~/utils/jev-build'
import { withItemStats } from '~/utils/jev-item-stats'
import { fitsWith } from '~/utils/item-groups'
import { batches, enemyRequest, itemReadKey, itemRequest, keepItemRead, knownItemRead, laneRequest, readItem, scoreOf } from '~/utils/jev-read'
import { answersDraft, rankSlot } from '~/utils/jev-recommend'
import { bootsUrgency, dueAt, healCutFits, withDraftBoots } from '~/utils/jev-rules'
import { readItemStats } from '~/utils/blitz/item-stats'
import { LANE_BASE, laneOptions } from '~/utils/jev-bases'

export type JevStatus = 'idle' | 'loading' | 'ready' | 'noKey' | 'noOptions' | 'error'

export type { EnemyReading } from '~/composables/useJevEnemies'

/**
 * The Jev matchup page's recommendation, on the player's click — Jev's calls
 * are paid. In order:
 *
 * 1. the measures: the options of the base the player chose (`base`,
 *    `utils/jev-bases`: the lane's — lolalytics' and Blitz's pooled game by
 *    game — by default, else the matchup's, a playstyle's or the
 *    one-tricks'), Blitz's item stats (win probability added, on the lane,
 *    against the lane opponent, at each place of the buying order and after
 *    the items the build holds before it), the enemies' measured damage split;
 * 2. what Jev reads (`utils/jev-read`): every enemy kit, every candidate item,
 *    the lane choices — three requests sent at once, only what this session has
 *    not read yet;
 * 3. the ranking (`utils/jev-recommend`): the team's needs, each option's fit,
 *    its measured signal and how well it suits our champion, slot by slot —
 *    the core item by item, then the items after the measured core closest to
 *    it, an item already in the build left out — and LoLTheory's rules
 *    (`utils/jev-rules`): a resistance due by its item slot, one Grievous
 *    Wounds item, an enchanter's boots after its second item.
 *
 * Beside it, the most played option of every slot of the same base, for
 * comparison; `answered` says which base the answer is for — another chosen
 * since waits for the next click.
 */
export function useJevBuild(
  subject: Ref<{ championId: number, request: CompositionBuildRequest } | null>,
  /** The base to rank within, read on the click; the lane when absent. */
  base?: () => Promise<LoadedBase | null>,
) {
  const { patch } = useChampionStatics()
  const { items, summoners, runeTree } = useStaticData()
  const { textOf, loadAll } = useChampionTexts()
  const english = useJevTexts()
  const reader = useJevEnemies()
  const status = ref<JevStatus>('idle')
  const error = ref<string | null>(null)
  const ranked = ref<RankedSlot[]>([])
  const needs = ref<{ team: Needs, lane: Needs } | null>(null)
  const enemies = ref<EnemyReading[]>([])
  const jevBuild = ref<LaidBuild | null>(null)
  const standardBuild = ref<LaidBuild | null>(null)
  const elapsedMs = ref<number | null>(null)
  const answered = ref<JevBase | null>(null)
  let generation = 0

  // A new draft drops the last answer: it was for another board. The same board recomputed (champion select's clock) keeps it.
  watch(() => JSON.stringify(subject.value), () => {
    generation++
    status.value = 'idle'
    ranked.value = []
    needs.value = null
    enemies.value = []
    jevBuild.value = null
    standardBuild.value = null
    answered.value = null
  })

  async function ask() {
    const current = subject.value
    if (!current) return
    const mine = ++generation
    if (!(await jevKeyStatus().catch(() => ({ set: false }))).set) return void (status.value = 'noKey')
    status.value = 'loading'
    error.value = null
    const started = performance.now()
    try {
      const { request, championId } = current
      const position = request.position
      const opponentId = request.enemies.find(enemy => enemy.position === position)?.championId ?? null
      const enemyIds = request.enemies.map(enemy => enemy.championId)

      // 1. The measures.
      const [loaded, laneStats, versusStats, slotStats] = await Promise.all([
        base ? base() : laneOptions(championId, position).then(options => (options ? { base: LANE_BASE, options } : null)),
        readItemStats(championId, position).catch(() => new Map()),
        opponentId ? readItemStats(championId, position, opponentId).catch(() => new Map()) : new Map(),
        Promise.all(Array.from({ length: INVENTORY }, (_, index) => readItemStats(championId, position, null, { slot: index + 1 }).catch(() => new Map()))),
        loadAll([championId, ...enemyIds]),
        english.load(),
        reader.load(),
      ])
      if (mine !== generation) return
      const options = loaded?.options
      if (!loaded || !options || !options.cores.length) return void (status.value = 'noOptions')

      const tree = runeTree.value
      const names: Names = {
        item: id => items.value[id]?.name ?? `Item ${id}`,
        perk: id => tree?.perks[id]?.name ?? `Rune ${id}`,
        style: id => tree?.perkStyles[id]?.name ?? `Tree ${id}`,
        spell: id => summoners.value[id]?.name ?? `Spell ${id}`,
      }
      const tags = (id: number) => items.value[id]?.tags ?? []
      const completed = (id: number) => {
        const item = items.value[id]
        return !!item && (item.totalGold ?? 0) >= 2000 && !(item.tags ?? []).some(tag => tag === 'Consumable' || tag === 'Trinket')
      }
      const pool = statsPool(laneStats, measuredPool(options), completed)
      const first = withItemStats(firstSlots(options, names, id => tags(id).includes('Consumable')), laneStats, versusStats)
      const slotOf = (name: string) => first.find(slot => slot.name === name)

      // 2. What Jev reads: the enemy kits, the candidate items, the lane choices — only what is new.
      const ours = textOf(championId)
      const opponent = opponentId ? textOf(opponentId) : null
      if (!ours) throw new Error('our champion is not known yet')
      const version = patch.value || 'live'
      const unreadEnemies = reader.unread(enemyIds)
      const candidates = candidateItems(options, pool).filter(id => items.value[id])
      const unreadItems = candidates.filter(id => !knownItemRead(itemReadKey(version, championId, position, id)))
      // What Jev reads is the game's English text (`useJevTexts`): its questions are English, and so are the game's terms in them.
      const en = { items: english.items.value, summoners: english.summoners.value, tree: english.runeTree.value }
      const enItem = (id: number) => en.items[id]?.name ?? names.item(id)
      const perkText = (id: number) => `${en.tree?.perks[id]?.name ?? names.perk(id)}: ${plainAbility(en.tree?.perks[id]?.shortDesc ?? en.tree?.perks[id]?.longDesc, 220)}`
      const lane = laneRequest({
        champion: ours,
        position,
        opponent,
        runePages: (slotOf('runes')?.options ?? []).map(option => ({
          key: option.key,
          text: option.page
            ? [option.page.primaryKeystoneId, option.page.primaryPerk1Id, option.page.primaryPerk2Id, option.page.primaryPerk3Id, option.page.secondaryPerk1Id, option.page.secondaryPerk2Id].map(perkText).join(' | ')
            : option.label,
        })),
        spells: (slotOf('spells')?.options ?? []).map(option => ({ key: option.key, text: (option.spellIds ?? []).map(id => `${en.summoners[id]?.name ?? names.spell(id)}: ${plainAbility(en.summoners[id]?.description, 200)}`).join(' | ') })),
        starters: (slotOf('starter')?.options ?? []).map(option => ({ key: option.key, text: option.itemIds.map(id => `${enItem(id)}: ${itemEffect(en.items[id] ?? items.value[id], 240)}`).join(' | ') })),
      })
      const requests: Request[] = [
        ...batches(enemyRequest(unreadEnemies)),
        ...batches(itemRequest(ours, position, unreadItems.map(id => ({ id, name: enItem(id), text: itemEffect(en.items[id] ?? items.value[id], 520) })))),
        ...batches(lane),
      ]
      const answers: Record<string, JevAnswer> = Object.assign({}, ...await Promise.all(requests.map(part => askJev(part.state, part.questions))))
      if (mine !== generation) return

      reader.keep(answers, unreadEnemies)
      for (const id of unreadItems) {
        const read = readItem(id, answers)
        if (read) keepItemRead(itemReadKey(version, championId, position, id), read)
      }
      const itemReads = new Map(candidates.flatMap((id) => {
        const read = knownItemRead(itemReadKey(version, championId, position, id))
        return read ? [[id, read] as [number, ItemRead]] : []
      }))
      const fits: Record<string, FitRead> = {}
      for (const [key, answer] of Object.entries(answers)) {
        if (!/^(?:r|s|st)_o\d+$/.test(key)) continue
        const read = scoreOf(answer)
        if (read) fits[key] = { fit: read.value, confidence: read.confidence }
      }
      const urgency = bootsUrgency(scoreOf(answers.bootsTiming)?.value ?? null, ours, position)

      // 3. The ranking: the team's needs, then every slot.
      const assessment = reader.assess(request.enemies, opponentId)
      const { team, lane: laneOf } = assessment
      const context = { team, lane: laneOf, itemReads, tags, fits, urgency }

      // Boots past the three most played that answer the lane (`withDraftBoots`).
      const bootsFor = (slot: (typeof first)[number]) => withItemStats([withDraftBoots(slot, options.boots, names.item, id => answersDraft(id, laneOf, itemReads, tags))], laneStats, versusStats)[0]!
      const result: RankedSlot[] = first.map(slot => rankSlot(slot.kind === 'boots' ? bootsFor(slot) : slot, context))
      const pickOf = (side: 'pick' | 'standard') => (name: string) => result.find(entry => entry.slot.name === name)?.[side] ?? null
      // What a build may hold: its boots and items within the inventory (the starting item that grows keeps a slot), no limited group over its count.
      const roomOf = (side: 'pick' | 'standard') => roomFor(pickOf(side)('starter')?.itemIds ?? []) - (pickOf(side)('boots') ? 1 : 0)
      const jevCore: number[] = []
      const jevLater: number[] = []
      const jevHeld = () => [...jevCore, ...(pickOf('pick')('boots')?.itemIds ?? []), ...jevLater]
      const fitsBuild = (id: number) => fitsWith(id, jevHeld()) && healCutFits(id, jevHeld(), itemReads)
      // The place the next item takes, boots apart: its slot of the buying order, the items before it, and the resistances due there.
      const bought = () => [...jevCore, ...jevLater]
      const dueNow = () => dueAt(assessment.dues, bought().length + 1, bought(), tags)
      const placeStats = async (): Promise<SlotStats> => ({
        slot: slotStats[bought().length],
        path: bought().length ? await readItemStats(championId, position, null, { path: bought() }).catch(() => new Map()) : undefined,
      })
      for (const slot of coreSlots(options, names)) {
        if (jevCore.length >= roomOf('pick')) break
        const open = slot.options.filter(option => option.itemIds.every(fitsBuild))
        if (!open.length) continue
        const [measured] = withItemStats([{ ...slot, options: open }], laneStats, versusStats, await placeStats())
        if (mine !== generation) return
        const entry = rankSlot(measured!, { ...context, due: dueNow() })
        jevCore.push(...entry.pick.itemIds)
        result.push(entry)
      }
      const follows = closestCore(options.cores, jevCore)
      // After the core, the draft's answers the build can use: none of the other kind of damage than the core's (Udyr on Liandry's Torment takes no Black Cleaver).
      const coreKind = jevCore.map(id => damageKind(tags(id))).find(kind => kind !== null) ?? null
      const suits = (id: number) => { const kind = damageKind(tags(id)); return !kind || !coreKind || kind === coreKind }
      for (const number of laterSlotNumbers(options, follows)) {
        if (jevCore.length + jevLater.length >= roomOf('pick')) break
        const due = dueNow()
        const next = laterSlot(options, follows, number, jevHeld(), names, { pool, suits, answersDraft: id => healCutFits(id, jevHeld(), itemReads) && answersDraft(id, team, itemReads, tags, due) })
        const open = next?.options.filter(option => option.itemIds.every(fitsBuild)) ?? []
        if (!next || !open.length) continue
        const [measured] = withItemStats([{ ...next, options: open }], laneStats, versusStats, await placeStats())
        if (mine !== generation) return
        const entry = rankSlot(measured!, { ...context, due })
        jevLater.push(...entry.pick.itemIds)
        result.push(entry)
      }
      const sourceCore = standardCore(options.cores).slice(0, roomOf('standard'))
      const standardFollows = closestCore(options.cores, sourceCore)
      const standardLater: number[] = []
      for (const number of laterSlotNumbers(options, standardFollows)) {
        if (sourceCore.length + standardLater.length >= roomOf('standard')) break
        const slot = laterSlot(options, standardFollows, number, [...sourceCore, ...(pickOf('standard')('boots')?.itemIds ?? []), ...standardLater], names)
        if (slot) standardLater.push(...slot.options[0]!.itemIds)
      }

      ranked.value = result
      needs.value = { team, lane: laneOf }
      enemies.value = assessment.readings
      jevBuild.value = laidBuild(pickOf('pick'), jevCore, jevLater)
      standardBuild.value = laidBuild(pickOf('standard'), sourceCore, standardLater)
      elapsedMs.value = Math.round(performance.now() - started)
      answered.value = loaded.base
      status.value = 'ready'
    }
    catch (failure) {
      if (mine !== generation) return
      error.value = failure instanceof Error ? failure.message : String(failure)
      status.value = 'error'
    }
  }

  return { status, error, ranked, needs, enemies, jevBuild, standardBuild, elapsedMs, answered, ask }
}
