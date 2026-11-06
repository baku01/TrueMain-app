import { experienceFromBlitz } from '~/utils/draft-experience'

/**
 * How far each champion's lane win rate moves once its players' experience is
 * taken out (`utils/draft-experience`), by `championId:position`. Read of
 * Blitz once a session — it moves with a patch, not a draft — and asked again
 * by the next screen after a failure; until it lands every champion keeps
 * its raw rate.
 */
export function useExperienceShifts() {
  const shifts = useState<Record<string, number>>('draft-experience-shifts', () => ({}))
  const status = useState<'idle' | 'pending' | 'ready'>('draft-experience-status', () => 'idle')

  if (status.value === 'idle') {
    status.value = 'pending'
    experienceFromBlitz()
      .then((read) => {
        shifts.value = read
        status.value = 'ready'
      })
      .catch(() => (status.value = 'idle'))
  }

  return shifts
}
