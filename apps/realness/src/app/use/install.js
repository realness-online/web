/**
 * Install state — captures the `beforeinstallprompt` event (Android + desktop
 * Chromium) so the UI can offer a real one-tap install, and tracks whether
 * Realness is already installed.
 *
 * The listeners register at module load. Import this once at app boot
 * (`@/main`) so the event — which fires early on eligible Chromium — is caught
 * before any lazy route mounts.
 */
import { ref, computed } from 'vue'
import { is_standalone, install_method } from '@/utils/platform'

/** @type {import('vue').Ref<any>} The deferred BeforeInstallPromptEvent, or null. */
const deferred = ref(null)
const installed = ref(is_standalone())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    deferred.value = event
  })
  window.addEventListener('appinstalled', () => {
    installed.value = true
    deferred.value = null
  })
}

export const use_install = () => {
  const can_install = computed(() => deferred.value !== null)

  /** Trigger the native install prompt. @returns {Promise<'accepted'|'dismissed'|null>} */
  const prompt_install = async () => {
    if (!deferred.value) return null
    deferred.value.prompt()
    const { outcome } = await deferred.value.userChoice
    deferred.value = null
    return outcome
  }

  return { method: install_method(), installed, can_install, prompt_install }
}
