import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import { scout_codes } from '../../server/halo/guest/realness-scout.js'

const sources = new URL(
  '../../../../vault/Projects/realness-leads/Sources.md',
  import.meta.url
)
const yc = scout_codes(readFileSync(sources, 'utf8')).find(
  scout => scout.site === 'yc'
)
const {
  filters_of,
  list_html,
  page_data,
  read: read_yc
} = await import(
  `data:text/javascript;base64,${Buffer.from(yc.code).toString('base64')}`
)

const cookies = [{ name: '_sso.key', value: 'k' }]

const page_html = (extra = '') =>
  `<html><head><meta name="csrf-token" content="tok"><script>window.AlgoliaOpts = {"app":"APP","key":"KEY"}</script></head><body>${extra}</body></html>`

const companies = {
  companies: [
    {
      name: 'Voltic',
      hiring_description: 'US-built cargo ships',
      jobs: [
        {
          id: 1,
          title: 'Asymmetric Upside Engineering',
          show_path: 'https://www.workatastartup.com/jobs/1',
          pretty_job_type: 'Contract',
          pretty_location_or_remote: 'Boston, MA, US / Remote (US)',
          pretty_salary_range: '$1 - $75K',
          description: '<p>Part-time mechanical engineer.</p>'
        }
      ]
    },
    { name: 'NoJobs', jobs: [] }
  ]
}

/** A fetcher answering the three calls a list read makes, recording them. */
const fetcher_of =
  ({ seen = [], page = page_html(), hits = [7] } = {}) =>
  async (url, options = {}) => {
    seen.push({ url: String(url), body: options.body })
    if (String(url).includes('algolia'))
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ hits: hits.map(company_id => ({ company_id })) }]
        })
      }
    if (String(url).endsWith('/companies/fetch'))
      return { ok: true, status: 200, json: async () => companies }
    return { ok: true, status: 200, text: async () => page }
  }

it('a list read asks Algolia for the filter in the URL, then fetch for the jobs', async () => {
  const seen = []
  const page = await read_yc(
    'https://www.workatastartup.com/companies?role=eng&jobType=contract',
    {
      cookies,
      fetcher: fetcher_of({ seen })
    }
  )
  assert.equal(page.status, 200)
  assert.match(page.html, /Asymmetric Upside Engineering/)
  assert.equal(seen.length, 3)
  assert.match(seen[0].url, /workatastartup\.com/)
  assert.match(seen[1].url, /algolia/)
  assert.match(seen[2].url, /companies\/fetch/)
  assert.match(seen[2].body, /"ids":\[7\]/)
})

it('a job page reads its own data-page', async () => {
  const data = {
    props: {
      company: { name: 'Voltic', hiring_description: 'cargo ships' },
      job: { id: 1, title: 'Engineer', description: '<p>Build it.</p>' }
    }
  }
  const page = await read_yc('https://www.workatastartup.com/jobs/1', {
    cookies,
    fetcher: async () => ({
      ok: true,
      status: 200,
      text: async () =>
        `<html><body><div data-page="${JSON.stringify(data).replace(/"/g, '&quot;')}"></div></body></html>`
    })
  })
  assert.equal(page.status, 200)
  assert.match(page.html, /Engineer/)
  assert.match(page.html, /Build it\./)
})

it('a page without a csrf token or key throws, so the halo renders', async () => {
  await assert.rejects(
    read_yc('https://www.workatastartup.com/companies', {
      cookies,
      fetcher: async () => ({
        ok: true,
        status: 200,
        text: async () => '<html><body>nothing</body></html>'
      })
    }),
    /csrf token or key/
  )
})

it('a refused page throws the status', async () => {
  await assert.rejects(
    read_yc('https://www.workatastartup.com/companies', {
      cookies,
      fetcher: async () => ({ ok: false, status: 403, text: async () => '' })
    }),
    /answered 403/
  )
})

it('the filter drops values the index does not take', () => {
  assert.equal(
    filters_of(
      'https://www.workatastartup.com/companies?role=eng&jobType=contract'
    ),
    '(role:eng) AND (job_type:"contract")'
  )
  assert.equal(
    filters_of('https://www.workatastartup.com/companies?role=<script>'),
    ''
  )
})

it('a list page keeps one article per job and skips empty companies', () => {
  const html = list_html(companies.companies)
  assert.equal((html.match(/<article/g) ?? []).length, 1)
  assert.match(html, /itemtype="https:\/\/schema\.org\/JobPosting"/)
  assert.match(html, /hiringOrganization/)
})

it('a brief list keeps the title, link, and one line, and drops the posting', () => {
  const html = list_html(companies.companies, { brief: true })
  assert.match(html, /Asymmetric Upside Engineering/)
  assert.doesNotMatch(html, /hiringOrganization/)
  assert.doesNotMatch(html, /Part-time mechanical engineer/)
})

it('data-page is decoded before it is parsed', () => {
  const data = page_data(
    '<div data-page="{&quot;props&quot;:{&quot;job&quot;:{&quot;id&quot;:1}}}"></div>'
  )
  assert.equal(data.props.job.id, 1)
})
