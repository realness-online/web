import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { ref, defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

// ── Mock browser APIs (run before imports) ──────────────────────────────

vi.hoisted(() => {
  // Notification API
  class MockNotification extends EventTarget {
    static permission = 'default'
    static requestPermission = vi.fn().mockResolvedValue('granted')
  }
  globalThis.Notification = /** @type {any} */ (MockNotification)

  // PushManager constructor (stub; pushManager is on the registration)
  globalThis.PushManager = vi.fn()

  // crypto.subtle.digest returns known bytes for endpoint hashing
  const subtle_digest = vi.fn().mockImplementation(async () => {
    const bytes = new Uint8Array(16)
    for (let i = 0; i < 16; i++) bytes[i] = i
    return bytes.buffer
  })
  Object.defineProperty(globalThis.crypto, 'subtle', {
    value: { digest: subtle_digest },
    configurable: true,
    writable: true
  })

  // Mock push subscription
  const mock_subscription = {
    endpoint: 'https://fcm.googleapis.com/some-endpoint',
    toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/some-endpoint' }),
    unsubscribe: vi.fn().mockResolvedValue(true)
  }

  // Mock pushManager
  const mock_get_subscription = vi.fn().mockResolvedValue(null)
  const mock_subscribe = vi.fn().mockResolvedValue(mock_subscription)

  const mock_registration = {
    pushManager: {
      getSubscription: mock_get_subscription,
      subscribe: mock_subscribe
    }
  }

  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(mock_registration) },
    configurable: true,
    writable: true
  })

  // localStorage.me is used by subscription_path()
  if (typeof localStorage !== 'undefined') {
    localStorage.me = '/+15551234567'
  }

  // Expose handles for tests
  globalThis.__mock_push = {
    mock_get_subscription,
    mock_subscribe,
    mock_registration,
    mock_subscription,
    subtle_digest,
    MockNotification
  }

  // Upload/remove mocks — in hoisted so vi.mock factory can use them
  globalThis.__mock_upload = vi.fn().mockResolvedValue(undefined)
  globalThis.__mock_remove = vi.fn().mockResolvedValue(undefined)
})

// ── Module mocks ────────────────────────────────────────────────────────

vi.mock('@/utils/serverless', () => ({
  upload: globalThis.__mock_upload,
  remove: globalThis.__mock_remove
}))

// ── Import AFTER mocks ──────────────────────────────────────────────────

import { use_push } from '@/use/push'

// ── Helpers ─────────────────────────────────────────────────────────────

/** Mount composable in a real Vue component so reactive refs work. */
function with_setup(composable) {
  let result
  const app = defineComponent({
    setup() {
      result = composable()
      return () => {}
    }
  })
  mount(app)
  return /** @type {ReturnType<typeof use_push>} */ (result)
}

/** Reset global state to defaults before each test. */
function reset_globals() {
  const { MockNotification, mock_get_subscription, mock_subscribe } =
    globalThis.__mock_push

  // Restore Notification if it was deleted
  if (!globalThis.Notification) {
    globalThis.Notification = MockNotification
  }
  MockNotification.permission = 'default'
  vi.mocked(MockNotification.requestPermission).mockResolvedValue('granted')

  // Restore PushManager if it was deleted
  if (!globalThis.PushManager) {
    globalThis.PushManager = vi.fn()
  }

  // Fully replace serviceWorker with a fresh resolved registration.
  // Rejected Promises are one-shot, so a new Promise is needed each time.
  // Use mockImplementation instead of mockResolvedValue for reliability
  // after vi.clearAllMocks().
  const fresh_registration = {
    pushManager: {
      getSubscription: mock_get_subscription,
      subscribe: mock_subscribe
    }
  }
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(fresh_registration) },
    configurable: true,
    writable: true
  })

  // Ensure localStorage.me is set for subscription paths
  if (typeof localStorage !== 'undefined') {
    localStorage.me = '/+15551234567'
  }

  mock_get_subscription.mockImplementation(() => Promise.resolve(null))
  mock_subscribe.mockImplementation(() =>
    Promise.resolve(globalThis.__mock_push.mock_subscription)
  )
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('@/use/push', () => {
  let push

  beforeEach(() => {
    vi.clearAllMocks()
    reset_globals()
    // Mount once — use_push returns module-level singleton refs
    push = with_setup(use_push)
    // Reset refs to defaults so state doesn't leak between tests
    push.subscribed.value = false
    push.permission.value = 'default'
    push.busy.value = false
  })

  // supported is a const evaluated at module load time. It reflects the
  // environment when this file was first imported (all APIs mocked), so it
  // is always true. The !supported branch of `status` and the early-return
  // guards in enable/disable/refresh are tested by deleting globals below.

  describe('status', () => {
    it('is "off" when permission is default and not subscribed', () => {
      expect(push.status.value).toBe('off')
    })

    it('is "on" when subscribed', async () => {
      globalThis.__mock_push.mock_get_subscription.mockImplementation(() =>
        Promise.resolve(globalThis.__mock_push.mock_subscription)
      )
      await push.refresh()
      expect(push.status.value).toBe('on')
    })

    it('is "blocked" when permission is denied', async () => {
      const { MockNotification } = globalThis.__mock_push
      MockNotification.permission = 'denied'
      await push.refresh()
      expect(push.status.value).toBe('blocked')
    })

    it('is "off" after enable then disable', async () => {
      await push.enable()
      expect(push.status.value).toBe('on')
      await push.disable()
      expect(push.status.value).toBe('off')
    })
  })

  describe('refresh', () => {
    it('reads Notification.permission and sets permission ref', async () => {
      const { MockNotification } = globalThis.__mock_push
      MockNotification.permission = 'denied'
      await push.refresh()
      expect(push.permission.value).toBe('denied')
    })

    it('sets subscribed to true when a subscription exists', async () => {
      globalThis.__mock_push.mock_get_subscription.mockImplementation(() =>
        Promise.resolve(globalThis.__mock_push.mock_subscription)
      )
      await push.refresh()
      expect(push.subscribed.value).toBe(true)
    })

    it('sets subscribed to false when no subscription exists', async () => {
      await push.refresh()
      expect(push.subscribed.value).toBe(false)
    })
  })

  describe('enable', () => {
    it('requests permission and subscribes', async () => {
      const ok = await push.enable()

      expect(ok).toBe(true)
      expect(Notification.requestPermission).toHaveBeenCalled()
      expect(push.permission.value).toBe('granted')
      expect(globalThis.__mock_push.mock_subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ userVisibleOnly: true })
      )
      expect(globalThis.__mock_upload).toHaveBeenCalled()
      expect(push.subscribed.value).toBe(true)
      expect(push.busy.value).toBe(false)
    })

    it('returns false when permission is denied', async () => {
      const { MockNotification } = globalThis.__mock_push
      vi.mocked(MockNotification.requestPermission).mockResolvedValue('denied')

      const ok = await push.enable()

      expect(ok).toBe(false)
      expect(push.permission.value).toBe('denied')
      expect(globalThis.__mock_upload).not.toHaveBeenCalled()
      expect(push.subscribed.value).toBe(false)
    })

    it('reuses an existing subscription', async () => {
      globalThis.__mock_push.mock_get_subscription.mockImplementation(() =>
        Promise.resolve(globalThis.__mock_push.mock_subscription)
      )
      const ok = await push.enable()

      expect(ok).toBe(true)
      expect(globalThis.__mock_push.mock_subscribe).not.toHaveBeenCalled()
      expect(globalThis.__mock_upload).toHaveBeenCalled()
    })

    it('returns false when registration fails', async () => {
      const err_spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const broken_sw = {
        ready: Promise.reject(new Error('no SW'))
      }
      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: broken_sw,
        configurable: true,
        writable: true
      })

      const ok = await push.enable()

      expect(ok).toBe(false)
      expect(push.subscribed.value).toBe(false)
      expect(push.busy.value).toBe(false)
      err_spy.mockRestore()
    })

    it('returns false when already busy', async () => {
      const first = push.enable()
      const second = await push.enable()

      expect(second).toBe(false)
      await first
    })

    it('logs and returns false on unexpected error', async () => {
      const console_spy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const { MockNotification } = globalThis.__mock_push
      vi.mocked(MockNotification.requestPermission).mockRejectedValue(
        new Error('boom')
      )

      const ok = await push.enable()

      expect(ok).toBe(false)
      expect(console_spy).toHaveBeenCalledWith(
        '[push] enable failed',
        expect.any(Error)
      )
      expect(push.busy.value).toBe(false)
      console_spy.mockRestore()
    })
  })

  describe('disable', () => {
    it('unsubscribes and removes the stored subscription', async () => {
      globalThis.__mock_push.mock_get_subscription.mockImplementation(() =>
        Promise.resolve(globalThis.__mock_push.mock_subscription)
      )
      await push.refresh()
      expect(push.subscribed.value).toBe(true)

      const ok = await push.disable()

      expect(ok).toBe(true)
      expect(globalThis.__mock_remove).toHaveBeenCalled()
      expect(
        globalThis.__mock_push.mock_subscription.unsubscribe
      ).toHaveBeenCalled()
      expect(push.subscribed.value).toBe(false)
      expect(push.busy.value).toBe(false)
    })

    it('succeeds even when no subscription exists', async () => {
      const ok = await push.disable()

      expect(ok).toBe(true)
      expect(globalThis.__mock_remove).not.toHaveBeenCalled()
      expect(push.subscribed.value).toBe(false)
    })

    it('returns false when already busy', async () => {
      const first = push.disable()
      const second = await push.disable()

      expect(second).toBe(false)
      await first
    })

    it('returns false on error and logs it', async () => {
      const console_spy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const broken_sw = {
        ready: Promise.reject(new Error('SW gone'))
      }
      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: broken_sw,
        configurable: true,
        writable: true
      })

      const ok = await push.disable()

      expect(ok).toBe(false)
      expect(console_spy).toHaveBeenCalledWith(
        '[push] disable failed',
        expect.any(Error)
      )
      expect(push.busy.value).toBe(false)
      console_spy.mockRestore()
    })
  })

  describe('concurrent guards', () => {
    it('disable returns false while enable is in progress', async () => {
      const enabling = push.enable()
      const disabled = await push.disable()
      expect(disabled).toBe(false)
      await enabling
    })

    it('enable returns false while disable is in progress', async () => {
      const disabling = push.disable()
      const enabled = await push.enable()
      expect(enabled).toBe(false)
      await disabling
    })
  })

  describe('unsupported environment (APIs removed after mount)', () => {
    it('enable returns false when Notification is gone', async () => {
      const err_spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const orig = globalThis.Notification
      delete globalThis.Notification
      try {
        const ok = await push.enable()
        expect(ok).toBe(false)
      } finally {
        globalThis.Notification = orig
        err_spy.mockRestore()
      }
    })

    it('disable returns false when serviceWorker is gone', async () => {
      const err_spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const orig = globalThis.navigator.serviceWorker
      delete globalThis.navigator.serviceWorker
      try {
        const ok = await push.disable()
        expect(ok).toBe(false)
      } finally {
        Object.defineProperty(globalThis.navigator, 'serviceWorker', {
          value: orig,
          configurable: true,
          writable: true
        })
        err_spy.mockRestore()
      }
    })

    it('refresh throws when Notification is missing', async () => {
      const orig = globalThis.Notification
      delete globalThis.Notification
      try {
        await expect(push.refresh()).rejects.toThrow('Notification')
      } finally {
        globalThis.Notification = orig
      }
    })
  })

  describe('busy flag lifecycle', () => {
    it('is false after enable completes', async () => {
      expect(push.busy.value).toBe(false)
      await push.enable()
      expect(push.busy.value).toBe(false)
    })

    it('is false after disable completes', async () => {
      expect(push.busy.value).toBe(false)
      await push.disable()
      expect(push.busy.value).toBe(false)
    })

    it('is true during an enable call', async () => {
      let busy_during_enable
      const enable_promise = push.enable()
      await Promise.resolve().then(() => {
        busy_during_enable = push.busy.value
      })
      await enable_promise
      expect(busy_during_enable).toBe(true)
    })
  })

  describe('data flow — enable then disable', () => {
    it('toggles subscribed state correctly', async () => {
      expect(push.subscribed.value).toBe(false)
      expect(push.status.value).toBe('off')

      await push.enable()

      expect(push.subscribed.value).toBe(true)
      expect(push.status.value).toBe('on')
      expect(globalThis.__mock_upload).toHaveBeenCalledTimes(1)

      // disable() calls getSubscription() independently — wire it to return
      // the existing subscription so remove/unsubscribe fire
      globalThis.__mock_push.mock_get_subscription.mockImplementation(() =>
        Promise.resolve(globalThis.__mock_push.mock_subscription)
      )

      await push.disable()

      expect(push.subscribed.value).toBe(false)
      expect(push.status.value).toBe('off')
      expect(globalThis.__mock_remove).toHaveBeenCalledTimes(1)
      expect(
        globalThis.__mock_push.mock_subscription.unsubscribe
      ).toHaveBeenCalledTimes(1)
    })
  })

  describe('VAPID key parsing', () => {
    it('passes a valid applicationServerKey to subscribe', async () => {
      await push.enable()

      expect(globalThis.__mock_push.mock_subscribe).toHaveBeenCalled()

      const call_args = globalThis.__mock_push.mock_subscribe.mock.calls[0][0]
      expect(call_args.userVisibleOnly).toBe(true)
      expect(call_args.applicationServerKey).toBeInstanceOf(Uint8Array)
      // 65 bytes = 4-byte padded base64 of a 256-bit VAPID key
      expect(call_args.applicationServerKey.byteLength).toBe(65)
    })
  })

  describe('endpoint id hashing', () => {
    it('produces a hex path for upload', async () => {
      await push.enable()

      expect(globalThis.__mock_upload).toHaveBeenCalled()
      const upload_path = globalThis.__mock_upload.mock.calls[0][0]
      // Path format: subscriptions/+<e164>/<32-char-hex>.json
      expect(upload_path).toMatch(/^subscriptions\/\+\d+\/[0-9a-f]{32}\.json$/)
    })

    it('produces a matching path for remove', async () => {
      globalThis.__mock_push.mock_get_subscription.mockImplementation(() =>
        Promise.resolve(globalThis.__mock_push.mock_subscription)
      )
      await push.refresh()
      await push.disable()

      expect(globalThis.__mock_remove).toHaveBeenCalled()
      const remove_path = globalThis.__mock_remove.mock.calls[0][0]
      expect(remove_path).toMatch(/^subscriptions\/\+\d+\/[0-9a-f]{32}\.json$/)
    })
  })
})
