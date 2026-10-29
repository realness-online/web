import { gunzipSync } from 'node:zlib'
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

/** `subscriptions/+A/id.json` (Firebase) or `people/+A/subscriptions/id.json.gz` (sync). */
const FIREBASE = /^subscriptions\/(\+\d+)\/([^/]+)\.json$/
const SYNC = /^people\/(\+\d+)\/subscriptions\/([^/]+)\.json\.gz$/

/**
 * Every stored subscription, one per person and id. Until gz6 a subscription
 * may sit in both places; sync's copy wins and both are pruned together.
 */
const subscriptions = async () => {
  const [[firebase], [sync]] = await Promise.all([
    bucket.getFiles({ prefix: 'subscriptions/' }),
    bucket.getFiles({ matchGlob: 'people/*/subscriptions/*.json.gz' })
  ])
  /** @type {Map<string, { read: any, copies: any[] }>} */
  const found = new Map()
  for (const [pattern, files] of [
    [SYNC, sync],
    [FIREBASE, firebase]
  ]) 
    for (const file of files) {
      const match = pattern.exec(file.name)
      if (!match) continue
      const key = `${match[1]}/${match[2]}`
      const entry = found.get(key)
      if (entry) entry.copies.push(file)
      else found.set(key, { read: file, copies: [file] })
    }
  
  return [...found.values()]
}

/** Stored bytes, unzipped when they are gzip (GCS may or may not unzip on download). */
const read_json = async file => {
  const [contents] = await file.download()
  const gzip = contents[0] === 0x1f && contents[1] === 0x8b
  return JSON.parse((gzip ? gunzipSync(contents) : contents).toString())
}

/**
 * Send a payload to every stored subscription, wherever it is stored (see
 * `subscriptions`). The admin SDK bypasses storage rules. Dead subscriptions
 * (404/410) are pruned, every copy.
 * @param {{ title: string, body?: string, url?: string, tag?: string }} payload
 * @returns {Promise<{ sent: number, removed: number, failed: number }>}
 */
export const broadcast = async payload => {
  configure()
  const found = await subscriptions()
  const message = JSON.stringify(payload)
  let sent = 0
  let removed = 0
  let failed = 0

  await Promise.all(
    found.map(async ({ read, copies }) => {
      try {
        const subscription = await read_json(read)
        await webpush.sendNotification(subscription, message)
        sent++
      } catch (error) {
        const code = error?.statusCode
        if (code === 404 || code === 410) {
          await Promise.all(copies.map(copy => copy.delete().catch(() => {})))
          removed++
        } else {
          failed++
          log_error('push send failed', {
            file: read.name,
            code: code ?? error?.message
          })
        }
      }
    })
  )

  return { sent, removed, failed }
}
