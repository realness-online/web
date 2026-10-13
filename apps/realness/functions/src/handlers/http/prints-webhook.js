import { onRequest as on_request } from 'firebase-functions/v2/https'
import { is_print_poster } from '#services/prints.js'
import { record_sale } from '#services/sale.js'
import { log_error, log_info, log_warn } from '#utils/log.js'
import { stripe_webhook_secret, verify_signature } from '#utils/stripe.js'

const RECORDING_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded'
])

/**
 * Webhook: on a completed Stripe checkout, write the sale into the poster.
 * The write happens before the reply - Cloud Functions may stop work after
 * the response, and a 500 makes Stripe retry.
 */
export const prints_webhook_handler = async (req, res) => {
  const signature = req.headers?.['stripe-signature']
  const secret = stripe_webhook_secret.value()?.trim()
  if (!verify_signature(req.rawBody, signature, secret)) {
    log_warn('prints webhook: bad signature')
    res.status(400).send('Bad signature')
    return
  }

  const event = JSON.parse(req.rawBody.toString('utf8'))
  const session = event.data?.object
  const poster_id = session?.metadata?.poster_id
  if (
    event.livemode !== true ||
    !RECORDING_EVENTS.has(event.type) ||
    session?.payment_status !== 'paid' ||
    !is_print_poster(poster_id, process.env.PRINTS_AUTHOR)
  ) {
    res.status(200).send('ignored')
    return
  }

  const paid_at = event.created ? new Date(event.created * 1000) : new Date()
  const sale = {
    amount: session.amount_total,
    session_id: session.id,
    date: paid_at.toISOString()
  }
  try {
    if (await record_sale(poster_id, sale)) {
      log_info('prints webhook: sale recorded', { poster_id, ...sale })
      log_info('prints webhook: index refresh needed', { poster_id })
    } else log_warn('prints webhook: edition or session already recorded', { poster_id, ...sale })
    res.status(200).send('ok')
  } catch (error) {
    log_error('prints webhook: storage write failed', error)
    res.status(500).send('Write failed')
  }
}

export const prints_webhook = on_request(
  { cors: false, secrets: [stripe_webhook_secret] },
  prints_webhook_handler
)
