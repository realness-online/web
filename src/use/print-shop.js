import { ref } from 'vue'
import { as_directory } from '@/persistence/Directory'
import { as_author, list, list_history_page } from '@/utils/itemid'
import { recent_number_first } from '@/utils/sorting'
import { thought_for_poster, thought_text } from '@realness.online/thoughts'

/** @typedef {import('@/types').Id} Id */

const CENTS_PER_DOLLAR = 100

// The $500 edition stays open after any number of sales; the others close.
export const OPEN_AMOUNT = 50000

/** Amounts arrive in cents and read as whole dollars. */
export const as_money = (amount, code) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (code || 'usd').toUpperCase(),
    maximumFractionDigits: 0
  }).format(amount / CENTS_PER_DOLLAR)

/**
 * The whole statement history, not only the live file: paging moves old
 * statements into their own pages, and a thought must not change shape
 * because it crossed a page boundary.
 * @param {Id} author - e.g. `/+16282281824`
 */
const statements_for = async author => {
  const live = await list(/** @type {Id} */ (`${author}/statements`))
  const directory = await as_directory(`${author}/statements`)
  const pages = (directory?.items ?? [])
    .filter(page => Number.isFinite(Number(page)))
    .sort(recent_number_first)
  const history = await Promise.all(
    pages.map(page =>
      list_history_page(/** @type {Id} */ (`${author}/statements/${page}`))
    )
  )
  return [...live, ...history.flat()]
}

/**
 * The thought a print was made with, by the same rule the feed uses: a run of
 * rows where each is within thirteen minutes of the one before.
 * @param {string} poster_id
 * @returns {Promise<string>}
 */
export const print_thought = async poster_id => {
  const author = as_author(/** @type {Id} */ (poster_id))
  if (!author) return ''
  const statements = await statements_for(/** @type {Id} */ (author))
  if (!statements.length) return ''
  return thought_text(
    thought_for_poster([{ id: poster_id }, ...statements], poster_id)
  )
}

/**
 * Stripe's word on one print: which editions are for sale, which are sold, and
 * the buy that opens checkout.
 * @param {import('vue').Ref<string>} poster_id
 */
export const use_print_editions = poster_id => {
  const amounts = ref(/** @type {number[]} */ ([]))
  const sold = ref(/** @type {number[]} */ ([]))
  const currency = ref('usd')
  // False until the shop has answered once, so a page rendered before its
  // script runs does not advertise a failure it has not had.
  const checked = ref(false)
  const loading = ref(false)
  const buying = ref(false)
  const buy_error = ref('')

  const load = async () => {
    const requested = poster_id.value
    amounts.value = []
    sold.value = []
    loading.value = true
    try {
      const res = await fetch(
        `/prints-checkout?poster_id=${encodeURIComponent(requested)}`
      )
      if (!res.ok) return
      const data = await res.json()
      if (
        poster_id.value !== requested ||
        !Array.isArray(data.amounts) ||
        !Array.isArray(data.sold)
      )
        return
      amounts.value = data.amounts
      sold.value = data.sold
      if (data.currency) currency.value = data.currency
    } catch {
      // An unavailable quote must not offer a checkout at a guessed price.
    } finally {
      if (poster_id.value === requested) {
        loading.value = false
        checked.value = true
      }
    }
  }

  const is_sold = amount =>
    amount !== OPEN_AMOUNT && sold.value.includes(amount)

  const buy = async amount => {
    const requested = poster_id.value
    if (
      buying.value ||
      !requested ||
      !amounts.value.includes(amount) ||
      is_sold(amount)
    )
      return
    buying.value = true
    buy_error.value = ''
    try {
      const res = await fetch('/prints-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poster_id: requested, amount })
      })
      // A 5xx from the function is JSON, a dev-server 404 is HTML - only the
      // former parses, so a failed parse is itself a failure, not a crash.
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        buy_error.value = data.error || 'Checkout unavailable'
        return
      }
      if (data.url) window.location.href = data.url
      else buy_error.value = 'Checkout unavailable'
    } catch {
      buy_error.value = 'Checkout unavailable'
    } finally {
      buying.value = false
    }
  }

  return {
    amounts,
    sold,
    currency,
    checked,
    loading,
    buying,
    buy_error,
    is_sold,
    load,
    buy
  }
}
