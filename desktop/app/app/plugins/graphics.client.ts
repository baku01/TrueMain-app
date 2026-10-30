/**
 * Applies the hardware-acceleration choice to every webview at start — the
 * app's window and the overlay's panels alike — so the GPU-heavy effects are
 * off from the first paint after a launch with acceleration off.
 */
export default defineNuxtPlugin(() => {
  void useGraphics().load().catch(() => {})
})
