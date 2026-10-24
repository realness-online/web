/**
 * h7: Git for VMs. A VM presents its harness pass; sync, which alone holds
 * the GitHub App's private key, mints an hour-long installation token scoped
 * to one repo, read-only. Nothing long-lived ever reaches a VM.
 *
 * Which repos a person's VMs may clone lives at `git/<phone>.html`, at the
 * bucket root. `can()` denies that folder to everyone, so only the bucket's
 * own key writes it. One article per account or org that installed the app;
 * a repo uses the installation of the article that lists it:
 *
 *   <article itemscope itemtype="https://schema.org/SoftwareApplication">
 *     <data itemprop="identifier" value="12345678">12345678</data>  (the app installation)
 *     <a itemprop="codeRepository" href="https://github.com/scott/realness">realness</a>
 *   </article>
 *   <article itemscope itemtype="https://schema.org/SoftwareApplication">
 *     <data itemprop="identifier" value="87654321">87654321</data>
 *     <a itemprop="codeRepository" href="https://github.com/Share-More-Stories/seeq-app">seeq-app</a>
 *   </article>
 *
 * Pushing needs its own grant, which this does not give.
 */
import { createSign as create_sign } from 'node:crypto'
import { HTTP } from '#root/lib/http.js'
import { MS_PER_SECOND } from '#root/lib/units.js'

const TOKEN_LIFE_S = 540

const API = 'https://api.github.com'
const REPO = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/
/** Read from an attribute only, `value` or the older `content`; text never grants. */
const INSTALLATION = /itemprop="identifier"\s+(?:value|content)="(\d{1,20})"/
const REPOSITORY =
  /itemprop="codeRepository"\s+href="https:\/\/github\.com\/([^"/]+\/[^"/]+?)(?:\.git)?\/?"/g

export class GitRefused extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** Each repo the person's VMs may clone, lowercased, to its installation. */
export const read_git_record = html => {
  const repos = new Map()
  for (const article of html.split(/<article\b/i)) {
    const installation = INSTALLATION.exec(article)?.[1]
    if (!installation) continue
    for (const [, repo] of article.matchAll(REPOSITORY)) {
      const name = repo.toLowerCase()
      if (!repos.has(name)) repos.set(name, installation)
    }
  }
  return repos
}

/** `owner/name` from what git's credential helper sends, or null. */
export const repo_name = value => {
  const repo = String(value ?? '')
    .replace(/^\/+/, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
  return REPO.test(repo) &&
    !repo.split('/').some(part => part === '.' || part === '..')
    ? repo
    : null
}

const base64url = value => Buffer.from(value).toString('base64url')

/** The app's own ten-minute JWT, RS256, as GitHub asks. */
const app_jwt = ({ app_id, private_key }, now = Date.now()) => {
  const seconds = Math.floor(now / MS_PER_SECOND)
  const head = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = base64url(
    JSON.stringify({
      iat: seconds - 60,
      exp: seconds + TOKEN_LIFE_S,
      iss: String(app_id)
    })
  )
  const signature = create_sign('RSA-SHA256')
    .update(`${head}.${body}`)
    .sign(private_key, 'base64url')
  return `${head}.${body}.${signature}`
}

/**
 * An hour-long, read-only token for one repo the person listed. Refusals:
 * 503 without an app, 404 for a repo not in the person's record (so a VM
 * cannot probe for other people's repos), 502 when GitHub says no.
 */
export const git_token = async ({
  storage,
  phone,
  repo,
  app,
  fetcher = fetch,
  now = Date.now()
}) => {
  if (!app?.app_id || !app?.private_key)
    throw new GitRefused(HTTP.UNAVAILABLE, 'git is not set up on this service')
  const name = repo_name(repo)
  if (!name) throw new GitRefused(HTTP.BAD_REQUEST, 'repo must be owner/name')
  const page = await storage.get(`git/${phone}.html`)
  const installation = read_git_record(
    page ? page.body.toString('utf8') : ''
  ).get(name.toLowerCase())
  if (!installation)
    throw new GitRefused(HTTP.NOT_FOUND, 'repo is not shared with this harness')
  const response = await fetcher(
    `${API}/app/installations/${installation}/access_tokens`,
    {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${app_jwt(app, now)}`,
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28'
      },
      body: JSON.stringify({
        repositories: [name.split('/')[1]],
        permissions: { contents: 'read' }
      })
    }
  )
  if (response.status !== HTTP.CREATED)
    throw new GitRefused(
      HTTP.BAD_GATEWAY,
      `GitHub refused a token: ${response.status}`
    )
  const { token, expires_at } = await response.json()
  if (typeof token !== 'string' || !token)
    throw new GitRefused(HTTP.BAD_GATEWAY, 'GitHub sent no token')
  return { token, expires_at }
}
