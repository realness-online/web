import { stripe_request } from '#utils/stripe.js'

export const TIER_AMOUNTS = [500, 10000, 50000]
export const OPEN_AMOUNT = 50000
export const CURRENCY = 'usd'

const PRODUCT = 'print'

/** realness.online and its host names (haight.realness.online), plus local dev. */
const ALLOWED_ORIGINS =
  /^https:\/\/(?:[a-z0-9-]+\.)*realness\.online(:\d+)?$|^http:\/\/localhost(:\d+)?$/
const PRODUCTION_ORIGIN = 'https://realness.online'

/**
 * The prints author is the only account whose posters are for sale.
 * `/+16282281824/posters/1712000000000` is the shape of a poster id.
 * @param {unknown} poster_id
 * @param {string | undefined} author - e.g. `/+16282281824`
 * @returns {poster_id is string}
 */
export const is_print_poster = (poster_id, author) => {
  if (typeof poster_id !== 'string' || !author) return false
  if (!poster_id.startsWith(`${author}/posters/`)) return false
  return /^\d+$/.test(poster_id.slice(`${author}/posters/`.length))
}

const SESSION_PAGE = 100

/**
 * Every paid print checkout Stripe knows of, as the sale the webhook would
 * have recorded. Checkout sessions have no search, so this pages the list;
 * the date is when the payment was made, falling back to the session's start.
 * @returns {Promise<Array<{ poster_id: string, amount: number, session_id: string, date: string }>>}
 */
export const paid_print_sessions = async () => {
  const sales = []
  let starting_after
  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- each page needs the last id
    const page = await stripe_request('checkout/sessions', {
      params: {
        status: 'complete',
        limit: SESSION_PAGE,
        expand: ['data.payment_intent'],
        starting_after
      }
    })
    for (const session of page.data) {
      if (session.metadata?.realness_product !== PRODUCT) continue
      if (session.payment_status !== 'paid') continue
      const paid_at = session.payment_intent?.created ?? session.created
      sales.push({
        poster_id: session.metadata.poster_id,
        amount: session.amount_total,
        session_id: session.id,
        date: new Date(paid_at * 1000).toISOString()
      })
    }
    if (!page.has_more || !page.data.length) return sales
    starting_after = page.data.at(-1).id
  }
}

/**
 * Which editions of this poster have paid sales. Stop once all three have
 * sold; later $500 sales cannot change the answer. Stripe search can lag, so
 * the poster webhook remains the durable record for a completed checkout.
 * @param {string} poster_id
 * @returns {Promise<number[]>}
 */
export const paid_print_amounts = async poster_id => {
  const amounts = new Set()
  let page
  do {
    // eslint-disable-next-line no-await-in-loop -- Stripe gives the next cursor
    const result = await stripe_request('payment_intents/search', {
      params: {
        query: `status:'succeeded' AND metadata['realness_product']:'${PRODUCT}' AND metadata['poster_id']:'${poster_id}'`,
        limit: 100,
        ...(page ? { page } : {})
      }
    })
    for (const payment of result.data) amounts.add(payment.amount)
    page = result.next_page
  } while (page && amounts.size < TIER_AMOUNTS.length)
  return TIER_AMOUNTS.filter(amount => amounts.has(amount))
}

/**
 * Where Stripe sends the buyer afterwards. Only realness origins qualify;
 * anything else lands on production.
 * @param {string | undefined} origin - request Origin header
 * @returns {string}
 */
export const return_origin = origin =>
  origin && ALLOWED_ORIGINS.test(origin) ? origin : PRODUCTION_ORIGIN

/**
 * A hosted checkout for one edition of a poster. The poster id rides
 * on the session and on the payment intent, so the webhook and the tier
 * search can both find it.
 * @param {{ poster_id: string, amount: number, origin?: string, image?: string | null }} options
 * @returns {Promise<{ url: string, id: string }>}
 */
export const create_print_checkout = async ({ poster_id, amount, origin, image }) => {
  const base = return_origin(origin)
  const metadata = { poster_id, realness_product: PRODUCT }
  const session = await stripe_request('checkout/sessions', {
    method: 'POST',
    params: {
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: amount,
            product_data: {
              name: 'Realness hand-finished print',
              ...(image ? { images: [image] } : {})
            }
          }
        }
      ],
      metadata,
      payment_intent_data: { metadata },
      shipping_address_collection: { allowed_countries: ['US'] },
      success_url: `${base}/prints?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/prints`
    }
  })
  return { url: session.url, id: session.id }
}
