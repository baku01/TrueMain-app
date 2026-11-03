import { blitzGet } from '~/utils/blitz/client'

/**
 * A champion's insights as Blitz publishes them beside its site
 * (`utils.iesdev.com/static/json/nexus/lol/champion-insights`): the key
 * insights, the strengths and the weaknesses, each a line of English text in
 * which `@spell_Q@` names an ability. Read once for every champion and kept.
 */
export interface ChampionInsights { insights: string[], strengths: string[], weaknesses: string[] }

/** A line split into text, abilities (`P`, `Q`, `W`, `E`, `R`) and items (`@item_3364@`), for the icons drawn in place. */
export type InsightToken = { text: string } | { spell: string } | { item: number }

let all: Promise<Map<number, ChampionInsights>> | null = null

export function readChampionInsights(championId: number): Promise<ChampionInsights | null> {
  if (!all) {
    all = blitzGet<{ championId: number, tips?: Partial<ChampionInsights> }[]>('nexus', 'champion-insights').then(list => new Map(
      list.map(entry => [entry.championId, { insights: entry.tips?.insights ?? [], strengths: entry.tips?.strengths ?? [], weaknesses: entry.tips?.weaknesses ?? [] }]),
    ))
    all.catch(() => (all = null))
  }
  return all.then(map => map.get(championId) ?? null)
}

export function insightTokens(line: string): InsightToken[] {
  return line.trim().split(/(@spell_[PQWER]@|@item_\d+@)/).filter(Boolean).map((part) => {
    const spell = /^@spell_([PQWER])@$/.exec(part)?.[1]
    if (spell) return { spell }
    const item = /^@item_(\d+)@$/.exec(part)?.[1]
    return item ? { item: Number(item) } : { text: part }
  })
}
