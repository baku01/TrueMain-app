/**
 * Jev, TypeSafe's System One model (`POST /v1/systemone`): a state and named
 * questions in, a typed answer per question out — for a `choice`, the option
 * it picks, its confidence and the probability of every option. Inside Tauri
 * the call and the API key stay in the shell (`src-tauri/src/jev.rs`); in
 * `npm run dev` the key is kept for the browser session and the call goes
 * through the dev server's `/__jev` proxy.
 */

export interface JevKeyStatus {
  set: boolean
  /** The key's last four characters. */
  hint: string | null
}

export interface JevChoiceQuestion {
  type: 'choice'
  instructions: string
  /** Each option's label to what it means. */
  criteria: Record<string, string>
}

/** A yes/no question (TypeSafe's "noul"): answered with the probability of yes. */
export interface JevNoulQuestion {
  type: 'noul'
  instructions: string
  criteria?: { true: string, false: string }
}

export type JevQuestion = JevChoiceQuestion | JevNoulQuestion

export interface JevChoiceAnswer {
  type: 'choice'
  choice: string
  confidence: number
  probabilities: Record<string, number>
}

export interface JevNoulAnswer {
  type: 'noul'
  noul: number
}

export type JevAnswer = JevChoiceAnswer | JevNoulAnswer

export const JEV_MODEL = 'jev-latest'
const DEV_KEY = 'truemain-jev-key'

async function invoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return await invoke<T>(command, args)
}

export async function jevKeyStatus(): Promise<JevKeyStatus> {
  if (insideTauri()) return await invoke<JevKeyStatus>('jev_key_status')
  const key = globalThis.sessionStorage?.getItem(DEV_KEY) ?? null
  return { set: !!key, hint: key ? key.slice(-4) : null }
}

/** Save the key, or forget it with null. */
export async function setJevKey(key: string | null): Promise<JevKeyStatus> {
  if (insideTauri()) return await invoke<JevKeyStatus>('jev_set_key', { key })
  if (key?.trim()) globalThis.sessionStorage?.setItem(DEV_KEY, key.trim())
  else globalThis.sessionStorage?.removeItem(DEV_KEY)
  return jevKeyStatus()
}

/** Ask every question about `state` in one call; the answers by question name. */
export async function askJev(state: string, questions: Record<string, JevQuestion>): Promise<Record<string, JevAnswer>> {
  const started = performance.now()
  const body = { model: JEV_MODEL, state, questions }
  const answer = insideTauri()
    ? await invoke<Record<string, unknown>>('jev_system_one', { body })
    : await $fetch<Record<string, unknown>>('/__jev/v1/systemone', {
        method: 'POST',
        body,
        headers: { Authorization: `Bearer ${globalThis.sessionStorage?.getItem(DEV_KEY) ?? ''}` },
      })
  console.info('[jev] call answered', { ms: Math.round(performance.now() - started) }, answer)
  // The answers sit under `answers` by question name; a bare map is read the same.
  return ((answer.answers ?? answer) as Record<string, JevAnswer>)
}
