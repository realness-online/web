import { createHmac as create_hmac, timingSafeEqual as timing_safe_equal } from 'node:crypto'
import { defineSecret as define_secret } from 'firebase-functions/params'
import { secret_set } from '#utils/secrets.js'

export const stripe_secret_key = define_secret('STRIPE_SECRET_KEY')
export const stripe_webhook_secret = define_secret('STRIPE_WEBHOOK_SECRET')

export const stripe_secret_bindings = [stripe_secret_key]
export const stripe_webhook_bindings = [stripe_secret_key, stripe_webhook_secret]

export const stripe_ready = () => secret_set(stripe_secret_key)

const API = 'https://api.stripe.com/v1/'

const API_VERSION = '2025-08-27.basil'

const SIGNATURE_TOLERANCE_SECONDS = 300

/**
 * Stripe signs `${t}.${raw_body}` with the endpoint secret and sends
 * `t=<seconds>,v1=<hex>` in the Stripe-Signature header.
 * @param {Buffer | undefined} raw_body - the bytes exactly as received
 * @param {string | undefined} header - Stripe-Signature
 * @param {string | undefined} secret - whsec_...
 * @param {number} [now] - seconds since the epoch
 * @returns {boolean}
 */
export const verify_signature = (raw_body, header, secret, now = Date.now() / 1000) => {
  if (!raw_body || !header || !secret) return false
  const pairs = header.split(',').map(pair => pair.split('='))
  const timestamp = pairs.find(([key]) => key === 't')?.[1]
  if (!timestamp || Math.abs(now - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS)
    return false

  const expected = create_hmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(raw_body)
    .digest()
  return pairs
    .filter(([key]) => key === 'v1')
    .map(([, signature]) => Buffer.from(signature ?? '', 'hex'))
    .some(given => given.length === expected.length && timing_safe_equal(given, expected))
}

/**
 * Stripe takes nested params as bracketed form keys:
 * `{ line_items: [{ quantity: 1 }] }` -> `line_items[0][quantity]=1`.
 * @param {Record<string, unknown>} params
 * @param {string} [prefix]
 * @param {URLSearchParams} [into]
 * @returns {URLSearchParams}
 */
export const form_encode = (params, prefix = '', into = new URLSearchParams()) => {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    const name = prefix ? `${prefix}[${key}]` : key
    if (typeof value === 'object') form_encode(value, name, into)
    else into.append(name, String(value))
  }
  return into
}

/**
 * One call against the Stripe REST API. Throws on any non-2xx with Stripe's
 * own message so the handler can log it.
 * @param {string} path - relative to /v1/, e.g. `checkout/sessions`
 * @param {{ method?: 'GET' | 'POST', params?: Record<string, unknown> }} [options]
 * @returns {Promise<any>}
 */
export const stripe_request = async (path, { method = 'GET', params } = {}) => {
  const url = new URL(path, API)
  const encoded = params ? form_encode(params) : null
  if (method === 'GET' && encoded) url.search = encoded.toString()

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${stripe_secret_key.value()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': API_VERSION
    },
    body: method === 'POST' && encoded ? encoded.toString() : undefined
  })

  const data = await response.json()
  if (!response.ok)
    throw new Error(data?.error?.message ?? `Stripe ${response.status}`)
  return data
}
