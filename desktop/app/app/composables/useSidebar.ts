const STORAGE_KEY = 'truemain-sidebar-collapsed'

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  }
  catch {
    return false
  }
}

/**
 * Whether the sidebar is a rail of icons. A window too narrow for the full
 * sidebar (`useNarrowWindow`) always folds it; otherwise it is the player's
 * choice, kept across launches. `canToggle` is false while the window decides.
 */
export function useSidebar() {
  const narrow = useNarrowWindow()
  const manual = useState<boolean>('sidebar-collapsed', readStored)
  const collapsed = computed(() => narrow.value || manual.value)
  const canToggle = computed(() => !narrow.value)

  function toggle() {
    if (!canToggle.value) return
    manual.value = !manual.value
    try {
      localStorage.setItem(STORAGE_KEY, manual.value ? '1' : '0')
    }
    catch {
      // Storage unavailable: the choice holds until the window closes.
    }
  }

  return { collapsed, canToggle, toggle }
}
