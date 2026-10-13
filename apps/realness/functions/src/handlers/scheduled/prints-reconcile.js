import { onSchedule as on_schedule } from 'firebase-functions/v2/scheduler'
import { is_print_poster, paid_print_sessions } from '#services/prints.js'
import { record_sale } from '#services/sale.js'
import { log_error, log_info } from '#utils/log.js'
import { stripe_secret_bindings } from '#utils/stripe.js'

/**
 * Stripe holds the truth about what sold; the poster files must agree. A
 * webhook can miss - an endpoint made after the sale, a bad secret, an app
 * re-save - so every paid print session is written again. `record_sale`
 * leaves recorded sessions alone and adds any missing editions.
 */
export const prints_reconcile_handler = async () => {
  const author = process.env.PRINTS_AUTHOR
  const paid = (await paid_print_sessions()).filter(({ poster_id }) =>
    is_print_poster(poster_id, author)
  )
  let recorded = 0
  let failed = 0
  for (const { poster_id, ...sale } of paid) {
    try {
      // eslint-disable-next-line no-await-in-loop -- one poster at a time
      if (await record_sale(poster_id, sale)) recorded++
    } catch (error) {
      failed++
      log_error('prints reconcile: write failed', {
        poster_id,
        error: error.message
      })
    }
  }
  log_info('prints reconcile', { paid: paid.length, recorded, failed })
}

export const prints_reconcile = on_schedule(
  {
    schedule: '0 4 * * *',
    timeZone: 'America/Los_Angeles',
    secrets: stripe_secret_bindings
  },
  prints_reconcile_handler
)
