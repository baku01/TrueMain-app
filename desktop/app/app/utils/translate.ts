/**
 * Machine translation of what people wrote — a guide's titles, notes and
 * chapters — by Google Translate's public endpoint (`translate_a/t`, the one
 * browser extensions use: free, no key). The source language is detected
 * (`sl=auto`: a guide may be written in any), HTML is translated as HTML, and
 * texts go in batches of a few thousand characters, each answer kept for the
 * session: a guide is translated once. A text the service did not answer
 * stays as it was written.
 */

const ENDPOINT = 'https://translate.googleapis.com/translate_a/t'

/** About as much as one request carries comfortably; a longer text goes alone. */
const BATCH_CHARS = 4500

const kept = new Map<string, Promise<string>>()

/** The service's word for the app's language (`pt-BR` → `pt`); null when nothing needs translating. */
export function translationTarget(locale: string): string | null {
  const language = locale.toLowerCase().split('-')[0] ?? ''
  return language && language !== 'en' ? language : null
}

/** Texts in batches of at most `limit` characters, in their order; one longer than it goes alone. */
export function batches(texts: string[], limit = BATCH_CHARS): string[][] {
  const out: string[][] = []
  let size = 0
  for (const text of texts) {
    const last = out.at(-1)
    if (last && size + text.length <= limit) {
      last.push(text)
      size += text.length
    }
    else {
      out.push([text])
      size = text.length
    }
  }
  return out
}

/** One request: each text's translation, in order (`[[text, detected language], …]`). */
async function request(texts: string[], target: string, html: boolean): Promise<string[]> {
  const body = new URLSearchParams(texts.map(text => ['q', text]))
  const answer = await $fetch<unknown>(`${ENDPOINT}?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&format=${html ? 'html' : 'text'}`, {
    method: 'POST',
    body: body.toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
    timeout: 20_000,
  })
  const rows = Array.isArray(answer) ? answer : [answer]
  return texts.map((text, index) => {
    const row: unknown = rows[index]
    const translated = Array.isArray(row) ? row[0] : row
    return typeof translated === 'string' && translated ? translated : text
  })
}

/**
 * `texts` translated into `target`, in order; each text asked once per
 * session whatever reads it again. `html`: the texts are HTML, whose markup
 * the service keeps — still to be sanitized again by whoever shows it.
 */
export async function translateTexts(texts: string[], target: string, html = false): Promise<string[]> {
  const key = (text: string) => `${target}:${html ? 'h' : 't'}:${text}`
  const missing = [...new Set(texts.filter(text => text.trim() && !kept.has(key(text))))]
  for (const group of batches(missing)) {
    const answer = request(group, target, html)
    group.forEach((text, index) => {
      const one = answer.then(rows => rows[index] ?? text)
      kept.set(key(text), one)
      // A failed batch is asked again next time rather than kept untranslated.
      one.catch(() => kept.delete(key(text)))
    })
  }
  return Promise.all(texts.map(text => (text.trim() ? (kept.get(key(text)) ?? Promise.resolve(text)).catch(() => text) : Promise.resolve(text))))
}
