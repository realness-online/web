/**
 * Platform / install detection.
 *
 * Pure, side-effect-free reads of the environment. The stateful
 * `beforeinstallprompt` handling lives in `@/use/install`.
 *
 * @typedef {'ios-safari'|'android-chrome'|'desktop-chromium'|'macos-safari'} InstallVideo
 * @typedef {{ video: InstallVideo | null, label: string, noun: string, can_prompt: boolean }} InstallMethod
 */

const agent = () =>
  typeof navigator === 'undefined' ? '' : navigator.userAgent

/** Running as an installed app (PWA) rather than a browser tab. */
export const is_standalone = () => {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    /** @type {any} */ (window.navigator).standalone === true
  )
}

/**
 * iPadOS Safari reports itself as macOS. Without this split an iPad would be
 * routed to the macOS "Add to Dock" flow instead of "Add to Home Screen".
 */
export const is_ipad = () =>
  typeof navigator !== 'undefined' &&
  navigator.platform === 'MacIntel' &&
  navigator.maxTouchPoints > 1

export const is_ios = () => /iPhone|iPad|iPod/.test(agent()) || is_ipad()
export const is_android = () => /Android/.test(agent())
export const is_firefox = () => /Firefox|FxiOS/.test(agent())
// Brave hides itself as Chrome; OPR is Opera — all Chromium, all install the same way.
export const is_chromium = () => /Chrome|CriOS|Edg|EdgiOS|OPR/.test(agent())

/**
 * The single walkthrough that matches this visitor, plus whether the browser
 * can offer a real one-tap install via `beforeinstallprompt`.
 * @returns {InstallMethod}
 */
export const install_method = () => {
  if (is_ios())
    return {
      video: 'ios-safari',
      label: is_ipad() ? 'iPad · Safari' : 'iPhone · Safari',
      noun: 'home screen',
      can_prompt: false
    }
  if (is_android())
    return {
      video: 'android-chrome',
      label: 'Android · Chrome',
      noun: 'home screen',
      can_prompt: true
    }
  if (is_firefox())
    return { video: null, label: 'Firefox', noun: 'device', can_prompt: false }
  if (is_chromium())
    return {
      video: 'desktop-chromium',
      label: 'Chrome · Edge · Brave',
      noun: 'desktop',
      can_prompt: true
    }
  return {
    video: 'macos-safari',
    label: 'macOS · Safari',
    noun: 'dock',
    can_prompt: false
  }
}

/**
 * Every flow, for the "other devices" disclosure and the no-JS / SSR fallback.
 * @type {Array<{ video: InstallVideo, label: string, portrait: boolean }>}
 */
export const all_methods = [
  { video: 'ios-safari', label: 'iPhone & iPad', portrait: true },
  { video: 'android-chrome', label: 'Android', portrait: true },
  {
    video: 'desktop-chromium',
    label: 'Chrome · Edge · Brave',
    portrait: false
  },
  { video: 'macos-safari', label: 'macOS Safari', portrait: false }
]
