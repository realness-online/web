import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mock_broadcast, mock_log_info } = vi.hoisted(() => ({
  mock_broadcast: vi.fn(),
  mock_log_info: vi.fn()
}))

vi.mock('#utils/push.js', () => ({
  broadcast: mock_broadcast,
  vapid_private_key: { name: 'VAPID_PRIVATE_KEY' }
}))

vi.mock('#utils/log.js', () => ({ log_info: mock_log_info }))

const { notification_handler } = await import(
  '#handlers/scheduled/notification.js'
)

describe('#handlers/scheduled/notification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('broadcasts the weekly nudge payload', async () => {
    mock_broadcast.mockResolvedValue({ sent: 3, removed: 0, failed: 0 })

    await notification_handler()

    expect(mock_broadcast).toHaveBeenCalledWith({
      title: 'Realness.online',
      body: "See what's been happening",
      url: '/'
    })
  })

  it('logs the broadcast result', async () => {
    mock_broadcast.mockResolvedValue({ sent: 2, removed: 1, failed: 0 })

    await notification_handler()

    expect(mock_log_info).toHaveBeenCalledWith('push broadcast', {
      sent: 2,
      removed: 1,
      failed: 0
    })
  })
})
