/**
 * Which storage the app uses: the Mac's sync service where the browser mode
 * names one (`dev-local`), Firebase Storage everywhere else. `synced` is
 * null on Firebase.
 */
import { browser_settings } from '../../settings/environments.js'
import { content_hash, sync_storage } from '@/utils/sync-storage'
import { create_hash } from '@/utils/upload-processor'

const sync_url = (() => {
  try {
    return browser_settings(import.meta.env.MODE).sync_url
  } catch {
    return undefined
  }
})()

/** @type {() => Promise<string | null>} */
let token_source = () => Promise.resolve(null)

/**
 * Who signs storage calls in; `serverless` names the signed-in user's token,
 * so this module never imports it back.
 * @param {() => Promise<string | null>} source
 */
export const use_token = source => {
  token_source = source
}

export const synced = sync_url
  ? sync_storage({
      base: sync_url,
      token: () => token_source()
    })
  : null

/**
 * The hash `customMetadata.hash` holds for this HTML: the stored bytes' hash
 * on sync, the HTML's own on Firebase.
 * @param {string} html
 */
export const hash_of = html => (synced ? content_hash(html) : create_hash(html))

/** Read a URL from storage's `url`; sync needs the sign-in token. */
export const fetch_file = address =>
  synced ? synced.fetch_file(address) : fetch(address)
