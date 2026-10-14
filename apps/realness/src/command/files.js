import { isUtf8 as is_utf8 } from 'node:buffer'

export class CapabilityError extends Error {
  constructor(code, message, result) {
    super(message)
    this.code = code
    this.result = result
  }
}

const required = (value, name) => {
  if (typeof value !== 'string' || !value)
    throw new CapabilityError('usage', `${name} is required`)
}

const require_personal_path = path => {
  required(path, 'remote path')
  if (!path.startsWith('can://~/'))
    throw new CapabilityError('usage', 'use a personal path: can://~/...')
}

/** @param {{ store: ReturnType<typeof import("#root/src/files/client.js").client> }} options */
export const file_capabilities = ({ store }) => ({
  async sync({ local, remote }) {
    required(local, 'local folder')
    require_personal_path(remote)
    const report = await store.sync(local, remote)
    if (report.conflicts.length)
      throw new CapabilityError(
        'sync_conflict',
        'Remote files changed during sync; retry after review',
        report
      )
    return report
  },

  async read({ path }) {
    require_personal_path(path)
    if (path.endsWith('/'))
      throw new CapabilityError('usage', 'cat needs a file path')
    const bytes = await store.cat(path)
    const encoding = is_utf8(bytes) ? 'utf8' : 'base64'
    return { path, encoding, content: bytes.toString(encoding) }
  }
})
