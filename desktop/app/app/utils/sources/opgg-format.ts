/**
 * op.gg's API answers in a compact text of its own rather than JSON: first a
 * line per class naming its fields (`class CoreItems: ids,ids_names,play,win,pick_rate`),
 * then the answer as constructor calls (`CoreItems([3118],["Malignance"],150215,77296,0.63)`).
 * This reads it back into plain objects, each call's arguments named by its
 * class's fields; a class the header does not declare stays a list.
 */
export type OpggValue = string | number | boolean | null | OpggValue[] | { [field: string]: OpggValue }

export function parseOpgg(text: string): OpggValue {
  const fields = new Map<string, string[]>()
  const body: string[] = []
  for (const line of text.split('\n')) {
    const declared = /^class (\w+)(?::\s*(.*))?$/.exec(line.trim())
    if (declared) fields.set(declared[1]!, (declared[2] ?? '').split(',').map(field => field.trim()).filter(Boolean))
    else if (line.trim()) body.push(line)
  }
  const source = body.join('\n')
  let at = 0

  const fail = (what: string): never => {
    throw new SyntaxError(`op.gg answer: ${what} at ${at}`)
  }
  const skip = () => {
    while (at < source.length && /[\s,]/.test(source[at]!)) at += 1
  }

  function list(close: string): OpggValue[] {
    const values: OpggValue[] = []
    at += 1
    skip()
    while (source[at] !== close) {
      if (at >= source.length) fail(`missing ${close}`)
      values.push(value())
      skip()
    }
    at += 1
    return values
  }

  function value(): OpggValue {
    skip()
    const char = source[at]
    if (char === '"') {
      const end = /"((?:[^"\\]|\\.)*)"/y
      end.lastIndex = at
      const match = end.exec(source) ?? fail('unterminated string')
      at = end.lastIndex
      return JSON.parse(`"${match[1]}"`) as string
    }
    if (char === '[') return list(']')
    const number = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y
    number.lastIndex = at
    const digits = number.exec(source)
    if (digits) {
      at = number.lastIndex
      return Number(digits[0])
    }
    const word = /[A-Za-z_]\w*/y
    word.lastIndex = at
    const name = word.exec(source)?.[0] ?? fail('unexpected character')
    at = word.lastIndex
    if (source[at] !== '(') {
      if (name === 'true' || name === 'false') return name === 'true'
      if (name === 'null' || name === 'None') return null
      return name
    }
    const args = list(')')
    const names = fields.get(name)
    if (!names?.length) return args
    return Object.fromEntries(names.map((field, index) => [field, args[index] ?? null]))
  }

  return value()
}
