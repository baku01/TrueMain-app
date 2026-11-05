import type { CompositionBuildRequest } from '~/types/build'
import type { JevAnswer } from '~/utils/jev'
import type { LaidBuild, Names } from '~/utils/jev-build'
import type { FitRead, ItemRead, Request } from '~/utils/jev-read'
import type { Needs, RankedSlot } from '~/utils/jev-recommend'
import { askJev, jevKeyStatus } from '~/utils/jev'
import { candidateItems, closestCore, coreSlots, firstSlots, itemEffect, laidBuild, laterSlot, laterSlotNumbers, measuredPool, plainAbility, standardCore, statsPool, withItemStats } from '~/utils/jev-build'
import { batches, enemyRequest, itemReadKey, itemRequest, keepItemRead, knownItemRead, laneRequest, readItem, scoreOf } from '~/utils/jev-read'
import { answersDraft, rankSlot } from '~/utils/jev-recommend'
import { readItemStats } from '~/utils/blitz/item-stats'
import { combineOptions } from '~/utils/sources/combined'
import { lolalyticsOptions } from '~/utils/sources/lolalytics'
import { blitzOptions } from '~/utils/sources/blitz'

export type JevStatus = 'idle' | 'loading' | 'ready' | 'noKey' | 'noOptions' | 'error'

export type { EnemyReading } from '~/composables/useJevEnemies'

/**
 * The Jev matchup page's recommendation, on the player's click — Jev's calls
 * are paid. In order:
 *
 * 1. the measures: lolalytics' and Blitz's options on the lane pooled game by
 *    game, Blitz's item stats (win probability added, on the lane and against
 *    the lane opponent), the enemies' measured damage split;
 * 2. what Jev reads (`utils/jev-read`): every enemy kit, every candidate item,
 *    the lane choices — three requests sent at once, only what this session has
 *    not read yet;
 * 3. the ranking (`utils/jev-recommend`): the team's needs, each option's fit,
 *    its measured signal and how well it suits our champion, slot by slot —
 *    the core item by item, then the items after the measured core closest to
 *    it, an item already in the build left out.
 *
 * Beside it, the most played option of every slot, for comparison.
 */
export function useJevBuild(subject: Ref<{ championId: number, request: CompositionBuildRequest } | null>) {
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
      const [options, laneStats, versusStats] = await Promise.all([
        Promise.all([
          lolalyticsOptions(championId, position).catch(() => null),
          blitzOptions(championId, position).catch(() => null),
        ]).then(([lolalytics, blitz]) => combineOptions(lolalytics, blitz)),
        readItemStats(championId, position).catch(() => new Map()),
        opponentId ? readItemStats(championId, position, opponentId).catch(() => new Map()) : new Map(),
        loadAll([championId, ...enemyIds]),
        english.load(),
        reader.load(),
      ])
      if (mine !== generation) return
      if (!options || !options.cores.length) return void (status.value = 'noOptions')

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
      const first = withItemStats(firstSlots(options, names), laneStats, versusStats)
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
      const urgency = scoreOf(answers.bootsTiming)?.value ?? null

      // 3. The ranking: the team's needs, then every slot.
      const assessment = reader.assess(request.enemies, opponentId)
      const { team, lane: laneOf } = assessment
      const context = { team, lane: laneOf, itemReads, tags, fits, urgency }
      const situational = { pool, answersDraft: (id: number) => answersDraft(id, team, itemReads, tags) }

      const result: RankedSlot[] = first.map(slot => rankSlot(slot, context))
      const boots = result.find(entry => entry.slot.name === 'boots')
      const jevCore: number[] = []
      for (const slot of withItemStats(coreSlots(options, names, situational), laneStats, versusStats)) {
        const open = slot.options.filter(option => !option.itemIds.some(id => jevCore.includes(id)))
        if (!open.length) continue
        const entry = rankSlot({ ...slot, options: open }, context)
        jevCore.push(...entry.pick.itemIds)
        result.push(entry)
      }
      const follows = closestCore(options.cores, jevCore)
      const jevLater: number[] = []
      for (const number of laterSlotNumbers(options, follows)) {
        const held = [...jevCore, ...(boots?.pick.itemIds ?? []), ...jevLater]
        const next = laterSlot(options, follows, number, held, names, situational)
        if (!next) continue
        const entry = rankSlot(withItemStats([next], laneStats, versusStats)[0]!, context)
        jevLater.push(...entry.pick.itemIds)
        result.push(entry)
      }
      const sourceCore = standardCore(options.cores)
      const standardFollows = closestCore(options.cores, sourceCore)
      const standardLater: number[] = []
      for (const number of laterSlotNumbers(options, standardFollows)) {
        const slot = laterSlot(options, standardFollows, number, [...sourceCore, ...(boots?.standard.itemIds ?? []), ...standardLater], names)
        if (slot) standardLater.push(...slot.options[0]!.itemIds)
      }

      const pickOf = (side: 'pick' | 'standard') => (name: string) => result.find(entry => entry.slot.name === name)?.[side] ?? null
      ranked.value = result
      needs.value = { team, lane: laneOf }
      enemies.value = assessment.readings
      jevBuild.value = laidBuild(pickOf('pick'), jevCore, jevLater)
      standardBuild.value = laidBuild(pickOf('standard'), sourceCore, standardLater)
      elapsedMs.value = Math.round(performance.now() - started)
      status.value = 'ready'
    }
    catch (failure) {
      if (mine !== generation) return
      error.value = failure instanceof Error ? failure.message : String(failure)
      status.value = 'error'
    }
  }

  return { status, error, ranked, needs, enemies, jevBuild, standardBuild, elapsedMs, ask }
}
