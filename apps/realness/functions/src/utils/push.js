import webpush from 'web-push'
import { defineSecret as define_secret } from 'firebase-functions/params'
import { bucket } from '#utils/firebase.js'
import { log_error } from '#utils/log.js'

export const vapid_private_key = define_secret('VAPID_PRIVATE_KEY')

const vapid_public_key =
  'BJAznHSd3bIvqCrP8qOA0RdzLiSuU5lKhWMXLa1t8Sd1aSvXRYbHJGOlewp6Sp7iY8UGP3092sWz_Zu-WHO4cUQ'
const vapid_subject = 'mailto:security@realness.online'

let configured = false
const configure = () => {
  if (configured) return
  webpush.setVapidDetails(
    vapid_subject,
    vapid_public_key,
    vapid_private_key.value()
  )
  configured = true
}

/**
 * Send a payload to every stored subscription. Subscription files live at
 * `subscriptions/+<e164>/<id>.json` (owner-only via storage rules; the admin
 * SDK here bypasses them). Dead subscriptions (404/410) are pruned.
 * @param {{ title: string, body?: string, url?: string, tag?: string }} payload
 * @returns {Promise<{ sent: number, removed: number, failed: number }>}
 */
export const broadcast = async payload => {
  configure()
  const [files] = await bucket.getFiles({ prefix: 'subscriptions/' })
  const message = JSON.stringify(payload)
  let sent = 0
  let removed = 0
  let failed = 0

  await Promise.all(
    files.map(async file => {
      if (!file.name.endsWith('.json')) return
      try {
        const [contents] = await file.download()
        const subscription = JSON.parse(contents.toString())
        await webpush.sendNotification(subscription, message)
        sent++
      } catch (error) {
        const code = error?.statusCode
        if (code === 404 || code === 410) {
          await file.delete().catch(() => {})
          removed++
        } else {
          failed++
          log_error('push send failed', { file: file.name, code: code ?? error?.message })
        }
      }
    })
  )

  return { sent, removed, failed }
}
