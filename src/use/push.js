import { ref, computed } from 'vue'
import { upload, remove } from '@/utils/serverless'

/**
 * Web Push opt-in. Redesign-independent plumbing: permission + subscribe /
 * unsubscribe, persisting the subscription as an owner-only Storage file at
 * `subscriptions/+<e164>/<id>.json` (out of the public `people/` tree). The
 * "Get notified" toggle in the Account redesign (#5) drives `enable`/`disable`
 * and reads `status` to render its states.
 */

// Public by design — the browser hands this to the push service openly, so it
// lives in source, not env. Must stay paired with the VAPID_PRIVATE_KEY secret
// the function signs with. Regenerate both: npx web-push generate-vapid-keys
const vapid_public_key =
  'BJAznHSd3bIvqCrP8qOA0RdzLiSuU5lKhWMXLa1t8Sd1aSvXRYbHJGOlewp6Sp7iY8UGP3092sWz_Zu-WHO4cUQ'

const supported =
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof window !== 'undefined' &&
  'PushManager' in window &&
  'Notification' in window

const is_ios = () =>
  typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent)

const is_installed = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari standalone flag (not in the standard Navigator type)
    /** @type {any} */ (window.navigator)?.standalone === true)

const BASE64_GROUP = 4
const HEX = 16
const ID_BYTES = 16

const url_base64_to_uint8 = base64 => {
  const pad = (BASE64_GROUP - (base64.length % BASE64_GROUP)) % BASE64_GROUP
  const normalized = (base64 + '='.repeat(pad))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  return Uint8Array.from(atob(normalized), char => char.charCodeAt(0))
}

/** Stable id per endpoint so re-subscribing the same device overwrites. */
const endpoint_id = async endpoint => {
  const bytes = new TextEncoder().encode(endpoint)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest).slice(0, ID_BYTES))
    .map(byte => byte.toString(HEX).padStart(2, '0'))
    .join('')
}

/** `subscriptions/+<e164>/<id>.json` — `localStorage.me` is `/+<e164>`. */
const subscription_path = id => `subscriptions${localStorage.me}/${id}.json`

const permission = ref(supported ? Notification.permission : 'denied')
const subscribed = ref(false)
const busy = ref(false)

const status = computed(() => {
  if (!supported) {
    if (is_ios() && !is_installed()) return 'needs-install'
    return 'unsupported'
  }
  if (is_ios() && !is_installed()) return 'needs-install'
  if (permission.value === 'denied') return 'blocked'
  return subscribed.value ? 'on' : 'off'
})

const registration = () => {
  if (!supported) return null
  return navigator.serviceWorker.ready
}

const refresh = async () => {
  if (!supported) return
  permission.value = Notification.permission
  const reg = await registration()
  const existing = await reg?.pushManager.getSubscription()
  subscribed.value = !!existing
}

const enable = async () => {
  if (busy.value || !supported) return false
  busy.value = true
  try {
    // The toggle tap is the user gesture iOS/Chrome require for this prompt.
    permission.value = await Notification.requestPermission()
    if (permission.value !== 'granted') return false

    const reg = await registration()
    if (!reg) return false

    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: url_base64_to_uint8(vapid_public_key)
      }))

    const id = await endpoint_id(sub.endpoint)
    await upload(subscription_path(id), JSON.stringify(sub.toJSON()), {
      contentType: 'application/json'
    })
    subscribed.value = true
    return true
  } catch (error) {
    console.error('[push] enable failed', error)
    return false
  } finally {
    busy.value = false
  }
}

const disable = async () => {
  if (busy.value || !supported) return false
  busy.value = true
  try {
    const reg = await registration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      const id = await endpoint_id(sub.endpoint)
      await remove(subscription_path(id))
      await sub.unsubscribe()
    }
    subscribed.value = false
    return true
  } catch (error) {
    console.error('[push] disable failed', error)
    return false
  } finally {
    busy.value = false
  }
}

export const use_push = () => ({
  supported,
  status,
  permission,
  subscribed,
  busy,
  refresh,
  enable,
  disable
})
