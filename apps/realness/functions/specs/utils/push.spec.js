import { gzipSync } from 'node:zlib'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mock_get_files,
  mock_set_vapid_details,
  mock_send_notification,
  mock_log_error
} = vi.hoisted(() => ({
  mock_get_files: vi.fn(),
  mock_set_vapid_details: vi.fn(),
  mock_send_notification: vi.fn(),
  mock_log_error: vi.fn()
}))

vi.mock('#utils/firebase.js', () => ({
  bucket: { getFiles: mock_get_files }
}))

vi.mock('#utils/log.js', () => ({ log_error: mock_log_error }))

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: mock_set_vapid_details,
    sendNotification: mock_send_notification
  }
}))

process.env.VAPID_PRIVATE_KEY = 'test-private-key'

const { broadcast } = await import('#utils/push.js')

const fake_file = (
  name,
  { contents, download_error, delete_error, gzip = false } = {}
) => ({
  name,
  download: download_error
    ? vi.fn().mockRejectedValue(download_error)
    : vi
        .fn()
        .mockResolvedValue([
          (gzip ? gzipSync : Buffer.from)(JSON.stringify(contents ?? {}))
        ]),
  delete: delete_error
    ? vi.fn().mockRejectedValue(delete_error)
    : vi.fn().mockResolvedValue(undefined)
})

describe('#utils/push', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_send_notification.mockResolvedValue(undefined)
  })

  it('configures VAPID details once per process', async () => {
    mock_get_files.mockResolvedValue([[]])

    await broadcast({ title: 'a' })
    await broadcast({ title: 'b' })

    expect(mock_set_vapid_details).toHaveBeenCalledTimes(1)
    expect(mock_set_vapid_details).toHaveBeenCalledWith(
      'mailto:security@realness.online',
      expect.any(String),
      'test-private-key'
    )
  })

  it('ignores non-json files under the subscriptions prefix', async () => {
    const readme = fake_file('subscriptions/+1555/readme.txt')
    mock_get_files.mockResolvedValue([[readme]])

    const result = await broadcast({ title: 'hi' })

    expect(readme.download).not.toHaveBeenCalled()
    expect(result).toEqual({ sent: 0, removed: 0, failed: 0 })
  })

  it('sends to every valid subscription file', async () => {
    const sub = { endpoint: 'https://push.example/1' }
    const file = fake_file('subscriptions/+1555/abc.json', { contents: sub })
    mock_get_files.mockResolvedValue([[file]])

    const result = await broadcast({ title: 'hi' })

    expect(mock_send_notification).toHaveBeenCalledWith(
      sub,
      JSON.stringify({ title: 'hi' })
    )
    expect(result).toEqual({ sent: 1, removed: 0, failed: 0 })
  })

  it('prunes a subscription that returns 404', async () => {
    const file = fake_file('subscriptions/+1555/dead.json', {
      contents: { endpoint: 'https://push.example/dead' }
    })
    mock_get_files.mockResolvedValue([[file]])
    mock_send_notification.mockRejectedValue(
      Object.assign(new Error('Gone'), { statusCode: 404 })
    )

    const result = await broadcast({ title: 'hi' })

    expect(file.delete).toHaveBeenCalled()
    expect(result).toEqual({ sent: 0, removed: 1, failed: 0 })
  })

  it('prunes a subscription that returns 410', async () => {
    const file = fake_file('subscriptions/+1555/dead.json', {
      contents: { endpoint: 'https://push.example/dead' }
    })
    mock_get_files.mockResolvedValue([[file]])
    mock_send_notification.mockRejectedValue(
      Object.assign(new Error('Gone'), { statusCode: 410 })
    )

    const result = await broadcast({ title: 'hi' })

    expect(file.delete).toHaveBeenCalled()
    expect(result).toEqual({ sent: 0, removed: 1, failed: 0 })
  })

  it('counts other send failures without deleting the file', async () => {
    const file = fake_file('subscriptions/+1555/flaky.json', {
      contents: { endpoint: 'https://push.example/flaky' }
    })
    mock_get_files.mockResolvedValue([[file]])
    mock_send_notification.mockRejectedValue(
      Object.assign(new Error('Server error'), { statusCode: 500 })
    )

    const result = await broadcast({ title: 'hi' })

    expect(file.delete).not.toHaveBeenCalled()
    expect(result).toEqual({ sent: 0, removed: 0, failed: 1 })
    expect(mock_log_error).toHaveBeenCalledWith('push send failed', {
      file: 'subscriptions/+1555/flaky.json',
      code: 500
    })
  })

  it('does not let a failed delete during pruning reject the batch', async () => {
    const file = fake_file('subscriptions/+1555/dead.json', {
      contents: { endpoint: 'https://push.example/dead' },
      delete_error: new Error('delete failed')
    })
    mock_get_files.mockResolvedValue([[file]])
    mock_send_notification.mockRejectedValue(
      Object.assign(new Error('Gone'), { statusCode: 410 })
    )

    const result = await broadcast({ title: 'hi' })

    expect(result).toEqual({ sent: 0, removed: 1, failed: 0 })
  })

  it('tallies a mix of outcomes across many subscriptions', async () => {
    const console_error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const ok = fake_file('subscriptions/+1/ok.json', {
      contents: { endpoint: 'ok' }
    })
    const dead = fake_file('subscriptions/+2/dead.json', {
      contents: { endpoint: 'dead' }
    })
    const flaky = fake_file('subscriptions/+3/flaky.json', {
      contents: { endpoint: 'flaky' }
    })
    mock_get_files.mockResolvedValue([[ok, dead, flaky]])
    mock_send_notification.mockImplementation(sub => {
      if (sub.endpoint === 'dead') {
        return Promise.reject(
          Object.assign(new Error('Gone'), { statusCode: 404 })
        )
      }
      if (sub.endpoint === 'flaky') return Promise.reject(new Error('boom'))
      return Promise.resolve()
    })

    const result = await broadcast({ title: 'hi' })

    expect(result).toEqual({ sent: 1, removed: 1, failed: 1 })
    console_error.mockRestore()
  })

  /** First getFiles call lists Firebase's `subscriptions/`, the second sync's copies. */
  const listed = (firebase, sync) =>
    mock_get_files.mockImplementation(async options =>
      options.prefix === 'subscriptions/' ? [firebase] : [sync]
    )

  it('reads gzip subscriptions where sync stores them', async () => {
    const sub = { endpoint: 'https://push.example/sync' }
    const file = fake_file('people/+1555/subscriptions/abc.json.gz', {
      contents: sub,
      gzip: true
    })
    listed([], [file])

    const result = await broadcast({ title: 'hi' })

    expect(mock_get_files).toHaveBeenCalledWith({
      matchGlob: 'people/*/subscriptions/*.json.gz'
    })
    expect(mock_send_notification).toHaveBeenCalledWith(sub, expect.any(String))
    expect(result).toEqual({ sent: 1, removed: 0, failed: 0 })
  })

  it('reads a sync copy that GCS already unzipped', async () => {
    const sub = { endpoint: 'https://push.example/plain' }
    listed(
      [],
      [fake_file('people/+1555/subscriptions/abc.json.gz', { contents: sub })]
    )

    expect(await broadcast({ title: 'hi' })).toEqual({
      sent: 1,
      removed: 0,
      failed: 0
    })
    expect(mock_send_notification).toHaveBeenCalledWith(sub, expect.any(String))
  })

  it("sends once when both copies exist, reading sync's", async () => {
    const plain = fake_file('subscriptions/+1555/abc.json', {
      contents: { endpoint: 'https://push.example/old' }
    })
    const synced = fake_file('people/+1555/subscriptions/abc.json.gz', {
      contents: { endpoint: 'https://push.example/new' },
      gzip: true
    })
    listed([plain], [synced])

    const result = await broadcast({ title: 'hi' })

    expect(plain.download).not.toHaveBeenCalled()
    expect(mock_send_notification).toHaveBeenCalledTimes(1)
    expect(mock_send_notification).toHaveBeenCalledWith(
      { endpoint: 'https://push.example/new' },
      expect.any(String)
    )
    expect(result).toEqual({ sent: 1, removed: 0, failed: 0 })
  })

  it('prunes every copy of a dead subscription', async () => {
    const plain = fake_file('subscriptions/+1555/dead.json')
    const synced = fake_file('people/+1555/subscriptions/dead.json.gz', {
      gzip: true
    })
    listed([plain], [synced])
    mock_send_notification.mockRejectedValue(
      Object.assign(new Error('Gone'), { statusCode: 410 })
    )

    const result = await broadcast({ title: 'hi' })

    expect(plain.delete).toHaveBeenCalled()
    expect(synced.delete).toHaveBeenCalled()
    expect(result).toEqual({ sent: 0, removed: 1, failed: 0 })
  })

  it('ignores other files under people', async () => {
    const poster = fake_file('people/+1555/posters/1.html.gz')
    listed([], [poster])

    expect(await broadcast({ title: 'hi' })).toEqual({
      sent: 0,
      removed: 0,
      failed: 0
    })
    expect(poster.download).not.toHaveBeenCalled()
  })
})
