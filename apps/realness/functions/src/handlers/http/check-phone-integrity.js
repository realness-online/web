import { onRequest as on_request } from 'firebase-functions/v2/https'
import { lookup_phone_integrity } from '#services/integrity.js'
import { log_warn, log_error } from '#utils/log.js'
import { request_json } from '#utils/request.js'
import {
  twilio_credentials,
  twilio_ready,
  twilio_secret_bindings
} from '#utils/twilio.js'

const e164 = /^\+[1-9]\d{1,14}$/
const is_e164 = phone => e164.test(phone)

export const check_phone_integrity_handler = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed')
    return
  }

  if (!twilio_ready()) {
    res.status(503).json({ error: 'Twilio not configured' })
    return
  }

  let payload
  try {
    payload = request_json(req)
  } catch {
    res.status(400).json({ error: 'Invalid JSON' })
    return
  }

  const phone = payload?.phone
  if (!phone || typeof phone !== 'string') {
    res.status(400).json({ error: 'Phone number is required' })
    return
  }
  if (!is_e164(phone)) {
    res.status(400).json({ error: 'Phone number must be E.164 format' })
    return
  }

  try {
    const result = await lookup_phone_integrity(phone, twilio_credentials())
    if (!result.allowed) {
      log_warn('integrity sign-in denied', {
        type: result.integrity_data.type,
        carrier_name: result.integrity_data.carrier_name
      })
    }
    res.json(result)
  } catch (error) {
    log_error('integrity lookup failed', error)
    res.status(502).json({ error: 'Lookup failed' })
  }
}

export const check_phone_integrity = on_request(
  { cors: true, secrets: twilio_secret_bindings },
  check_phone_integrity_handler
)
