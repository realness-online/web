import { onRequest as on_request } from 'firebase-functions/v2/https'
import { stripe_ready, stripe_secret_bindings } from '#utils/stripe.js'
import {
  twilio_ready,
  twilio_secret_bindings
} from '#utils/twilio.js'

export const capabilities_handler = (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed')
    return
  }

  res.json({
    push: true,
    phone_integrity: twilio_ready(),
    prints: stripe_ready()
  })
}

export const capabilities = on_request(
  { cors: true, secrets: [...twilio_secret_bindings, ...stripe_secret_bindings] },
  capabilities_handler
)
