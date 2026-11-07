import type { ClipIndex } from './voice'
import type { PackManifest, PackRead } from './voice-pack'

/**
 * The voice packs the player imported, kept in the webview's IndexedDB: one
 * origin for the app's window and the overlay's, so the panel that speaks
 * reads what the Overlay page imported, with no file on disk of ours. Two
 * stores: `packs`, each pack's manifest and its clips' index, and `clips`,
 * each clip's audio as a Blob.
 */

const DATABASE = 'truemain-voice'
const VERSION = 1

export interface VoicePack extends PackManifest {
  id: string
  importedAt: number
  /** The clips' size, in bytes. */
  bytes: number
  clips: ClipIndex
}

interface StoredClip {
  id: string
  pack: string
  blob: Blob
}

let opening: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('packs')) db.createObjectStore('packs', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('clips')) db.createObjectStore('clips', { keyPath: 'id' }).createIndex('pack', 'pack')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      opening = null
      reject(request.error)
    }
  })
  return opening
}

const done = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const finished = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve()
  transaction.onerror = () => reject(transaction.error)
  transaction.onabort = () => reject(transaction.error)
})

export async function listPacks(): Promise<VoicePack[]> {
  const db = await open()
  const packs = await done(db.transaction('packs').objectStore('packs').getAll() as IDBRequest<VoicePack[]>)
  return packs.sort((a, b) => a.importedAt - b.importedAt)
}

export async function getPack(id: string): Promise<VoicePack | null> {
  const db = await open()
  return (await done(db.transaction('packs').objectStore('packs').get(id) as IDBRequest<VoicePack | undefined>)) ?? null
}

/** Keep a pack read from its ZIP, its clips and its index in one transaction: all of it or nothing. */
export async function savePack(read: PackRead): Promise<VoicePack> {
  const db = await open()
  // Not `crypto.randomUUID`: the app's custom-protocol origin is not a secure context everywhere.
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const clips: Record<string, string[]> = {}
  let bytes = 0
  const transaction = db.transaction(['packs', 'clips'], 'readwrite')
  const store = transaction.objectStore('clips')
  for (const clip of read.clips) {
    const clipId = `${id}/${clip.name}#${clip.variant}`
    ;(clips[clip.name] ??= []).push(clipId)
    bytes += clip.data.length
    store.put({ id: clipId, pack: id, blob: new Blob([clip.data as Uint8Array<ArrayBuffer>], { type: clip.type }) } satisfies StoredClip)
  }
  const pack: VoicePack = { ...read.manifest, id, importedAt: Date.now(), bytes, clips }
  transaction.objectStore('packs').put(pack)
  await finished(transaction)
  return pack
}

export async function deletePack(id: string) {
  const db = await open()
  const transaction = db.transaction(['packs', 'clips'], 'readwrite')
  transaction.objectStore('packs').delete(id)
  const clips = transaction.objectStore('clips')
  const keys = await done(clips.index('pack').getAllKeys(id))
  for (const key of keys) clips.delete(key)
  await finished(transaction)
}

export async function clipBlob(id: string): Promise<Blob | null> {
  const db = await open()
  const clip = await done(db.transaction('clips').objectStore('clips').get(id) as IDBRequest<StoredClip | undefined>)
  return clip?.blob ?? null
}
