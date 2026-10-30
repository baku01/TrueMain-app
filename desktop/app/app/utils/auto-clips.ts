import type { AutoClipKind, Clip } from '~/types/recordings'
import { isMarked } from '~/utils/recording-moments'
import { tr } from '#common/utils/i18n'

/**
 * The automatic clips (#1766): the plays the shell cuts as clips of their own
 * once a game is finalised, and how a clip says where it came from.
 */

/** Every kind, in the order the settings list them — the biggest plays first. */
export const AUTO_CLIP_KINDS: { value: AutoClipKind, label: string, description: string }[] = [
  { value: 'multiKill', get label() { return tr('rec.auto.multiKill.label') }, get description() { return tr('rec.auto.multiKill.description') } },
  { value: 'combo', get label() { return tr('rec.auto.combo.label') }, get description() { return tr('rec.auto.combo.description') } },
  { value: 'steal', get label() { return tr('rec.auto.steal.label') }, get description() { return tr('rec.auto.steal.description') } },
  { value: 'ace', get label() { return tr('rec.auto.ace.label') }, get description() { return tr('rec.auto.ace.description') } },
  { value: 'teamfight', get label() { return tr('rec.auto.teamfight.label') }, get description() { return tr('rec.auto.teamfight.description') } },
  { value: 'firstBlood', get label() { return tr('rec.auto.firstBlood.label') }, get description() { return tr('rec.auto.firstBlood.description') } },
]

/** The shell's own order (`AutoClipKind::ALL`), which the saved settings keep. */
const SHELL_ORDER: AutoClipKind[] = ['multiKill', 'steal', 'ace', 'firstBlood', 'teamfight', 'combo']

/** The kinds with one turned on or off, in the shell's order. */
export function toggleAutoClip(kinds: readonly AutoClipKind[], kind: AutoClipKind, on: boolean): AutoClipKind[] {
  return SHELL_ORDER.filter(entry => (entry === kind ? on : kinds.includes(entry)))
}

/** A clip's icon and what it says: marked in game, clipped automatically, or cut by hand. */
export function clipOrigin(clip: Pick<Clip, 'moments' | 'automatic'>): { icon: string, label: string } {
  if (clip.moments.some(isMarked)) return { icon: 'i-lucide-bookmark', label: tr('rec.origin.marked') }
  if (clip.automatic.length) return { icon: 'i-lucide-sparkles', label: tr('rec.origin.auto') }
  return { icon: 'i-lucide-scissors', label: tr('rec.origin.clip') }
}
