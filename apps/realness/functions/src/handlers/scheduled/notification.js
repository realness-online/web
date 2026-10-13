import { onSchedule as on_schedule } from 'firebase-functions/v2/scheduler'
import { broadcast, vapid_private_key } from '#utils/push.js'
import { log_info } from '#utils/log.js'

export const notification_handler = async () => {
  const result = await broadcast({
    title: 'Realness.online',
    body: "See what's been happening",
    url: '/'
  })
  log_info('push broadcast', result)
}

export const notification = on_schedule(
  {
    schedule: '0 15 * * 4',
    timeZone: 'America/Los_Angeles',
    secrets: [vapid_private_key]
  },
  notification_handler
)
