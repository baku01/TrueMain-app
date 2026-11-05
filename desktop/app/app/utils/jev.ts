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

export interface JevChoiceAnswer {
  type: 'choice'
  choice: string
  confidence: number
  probabilities: Record<string, number>
}

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

/** What a call says of itself: the model that answered, and the usage when TypeSafe reports it. */
export interface JevCallTrace {
  model: string | null
  usage: unknown
  /** Characters of the request sent, a rough measure of its tokens (about four characters each). */
  requestChars: number
  ms: number
}

/** Every call made this session, newest last: the proof a call went out, and what it cost. */
export const jevTrace: JevCallTrace[] = []

/** Ask every question about `state` in one call; the answers by question name. */
export async function askJev(state: string, questions: Record<string, JevChoiceQuestion>): Promise<Record<string, JevChoiceAnswer>> {
  const started = performance.now()
  const body = { model: JEV_MODEL, state, questions }
  const answer = insideTauri()
    ? await invoke<Record<string, unknown>>('jev_system_one', { body })
    : await $fetch<Record<string, unknown>>('/__jev/v1/systemone', {
        method: 'POST',
        body,
        headers: { Authorization: `Bearer ${globalThis.sessionStorage?.getItem(DEV_KEY) ?? ''}` },
      })
  const trace: JevCallTrace = {
    model: typeof answer.model === 'string' ? answer.model : null,
    usage: answer.usage ?? null,
    requestChars: JSON.stringify(body).length,
    ms: Math.round(performance.now() - started),
  }
  jevTrace.push(trace)
  console.info('[jev] call answered', trace, answer)
  // The answers sit under `answers` by question name; a bare map is read the same.
  return ((answer.answers ?? answer) as Record<string, JevChoiceAnswer>)
}
