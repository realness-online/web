import { onRequest as on_request } from 'firebase-functions/v2/https'
import {
  CURRENCY,
  OPEN_AMOUNT,
  TIER_AMOUNTS,
  create_print_checkout,
  is_print_poster,
  paid_print_amounts
} from '#services/prints.js'
import { print_preview_url } from '#services/print-details.js'
import { log_error, log_info } from '#utils/log.js'
import { request_json } from '#utils/request.js'
import { stripe_ready, stripe_secret_bindings } from '#utils/stripe.js'

export const prints_checkout_handler = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).send('Method Not Allowed')
    return
  }

  if (!stripe_ready()) {
    res.status(503).json({ error: 'Stripe not configured' })
    return
  }

  let payload
  try {
    payload = req.method === 'POST' ? request_json(req) : {}
  } catch {
    res.status(400).json({ error: 'Invalid JSON' })
    return
  }

  const poster_id = req.method === 'GET' ? req.query?.poster_id : payload.poster_id
  if (!is_print_poster(poster_id, process.env.PRINTS_AUTHOR)) {
    res.status(400).json({ error: 'Poster is not for sale' })
    return
  }

  try {
    const sold = await paid_print_amounts(poster_id)
    if (req.method === 'GET') {
      res.json({ amounts: TIER_AMOUNTS, sold, currency: CURRENCY })
      return
    }
    const { amount } = payload
    if (!TIER_AMOUNTS.includes(amount)) {
      res.status(400).json({ error: 'Invalid print price' })
      return
    }
    if (amount !== OPEN_AMOUNT && sold.includes(amount)) {
      res.status(400).json({ error: 'Print edition already sold' })
      return
    }
    const { url, id } = await create_print_checkout({
      poster_id,
      amount,
      origin: req.headers?.origin,
      image: await print_preview_url(poster_id)
    })
    log_info('print checkout created', { poster_id, amount, session: id })
    res.json({ url, amount, currency: CURRENCY })
  } catch (error) {
    log_error('print checkout failed', error)
    res.status(502).json({ error: 'Checkout unavailable' })
  }
}

export const prints_checkout = on_request(
  { cors: true, secrets: stripe_secret_bindings },
  prints_checkout_handler
)
