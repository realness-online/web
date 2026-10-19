import { isUtf8 as is_utf8 } from 'node:buffer'
import { HTTP } from '#root/lib/http.js'
import { ISO_DATE } from '#root/lib/units.js'
import { day_files, read_rows, sum_rows } from '#root/src/proxy/rows.js'
/* eslint-disable no-await-in-loop -- ledger pages are read one at a time to keep the sync service quiet */

export { day_files, read_rows, sum_rows }

/** Every UTC day of `now`'s month, up to and including today. */
const month_days = (now = new Date()) => {
  const end = now.toISOString().slice(0, ISO_DATE)
  const days = []
  for (
    const at = new Date(`${end.slice(0, 8)}01T00:00:00Z`);
    at.toISOString().slice(0, ISO_DATE) <= end;
    at.setUTCDate(at.getUTCDate() + 1)
  )
    days.push(at.toISOString().slice(0, ISO_DATE))
  return days
}

/** The ledger path for one person and day, under `usage/`. */
const usage_day = (phone, day) => `usage/${phone}/${day}/`

const add = (a, b) => ({ tokens: a.tokens + b.tokens, cost: a.cost + b.cost })

/** The ledger under `usage/+A/<day>/`, read through the service. */
export const ledger = store => ({
  async spent(phone, now = new Date()) {
    const sums = []
    let found = false
    for (const day of month_days(now)) {
      const folder = usage_day(phone, day)
      const listed = await store.ls(`can://${folder}`).catch(error => {
        if (error.status === HTTP.NOT_FOUND || error.message.endsWith(': 404'))
          return null
        throw error
      })
      if (listed) found = true
      const names = (listed ?? []).filter(name => !name.endsWith('/'))
      const ordered = day_files(names).filter(name => names.includes(name))
      let html = ''
      for (const name of ordered) {
        const page = await store.cat(`can://${folder}${name}`)
        if (!is_utf8(page)) throw new Error('model ledger is not UTF-8')
        html += page.toString('utf8')
      }
      sums.push({ date: day, ...sum_rows(read_rows(html, phone)) })
    }
    if (!found) throw new Error('no model ledger for this month')
    const today = sums.at(-1)
    return {
      day: { tokens: today.tokens, cost: today.cost },
      month: sums.reduce(add, { tokens: 0, cost: 0 }),
      daily: sums
    }
  }
})
