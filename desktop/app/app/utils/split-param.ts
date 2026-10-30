import { tr } from '#common/utils/i18n'

/**
 * A message cut around one parameter, for a sentence whose figure is styled on
 * its own (`<span>50</span> gold short`): the text before it and after it, in
 * whatever order the language puts them.
 */
export function aroundParam(key: string, name: string): [before: string, after: string] {
  const marker = '\u0000'
  const [before = '', after = ''] = tr(key, { [name]: marker }).split(marker)
  return [before, after]
}
