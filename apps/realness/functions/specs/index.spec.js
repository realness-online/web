import { describe, it, expect, vi } from 'vitest'

const {
  fake_capabilities,
  fake_check_phone_integrity,
  fake_prints_checkout,
  fake_prints_list,
  fake_prints_reconcile,
  fake_print_share,
  fake_prints_webhook,
  fake_notification
} = vi.hoisted(() => ({
  fake_capabilities: { name: 'capabilities' },
  fake_check_phone_integrity: { name: 'check_phone_integrity' },
  fake_prints_checkout: { name: 'prints_checkout' },
  fake_prints_list: { name: 'prints_list' },
  fake_prints_reconcile: { name: 'prints_reconcile' },
  fake_print_share: { name: 'print_share' },
  fake_prints_webhook: { name: 'prints_webhook' },
  fake_notification: { name: 'notification' }
}))

vi.mock('#handlers/http/capabilities.js', () => ({
  capabilities: fake_capabilities
}))
vi.mock('#handlers/http/check-phone-integrity.js', () => ({
  check_phone_integrity: fake_check_phone_integrity
}))
vi.mock('#handlers/http/prints-checkout.js', () => ({
  prints_checkout: fake_prints_checkout
}))
vi.mock('#handlers/http/print-share.js', () => ({ print_share: fake_print_share }))
vi.mock('#handlers/http/prints-webhook.js', () => ({
  prints_webhook: fake_prints_webhook
}))
vi.mock('#handlers/scheduled/notification.js', () => ({
  notification: fake_notification
}))
vi.mock('#handlers/http/prints-list.js', () => ({
  prints_list: fake_prints_list
}))
vi.mock('#handlers/scheduled/prints-reconcile.js', () => ({
  prints_reconcile: fake_prints_reconcile
}))

describe('index.js', () => {
  it('re-exports every deployed function', async () => {
    const exported = await import('../index.js')

    expect(exported.capabilities).toBe(fake_capabilities)
    expect(exported.check_phone_integrity).toBe(fake_check_phone_integrity)
    expect(exported.prints_checkout).toBe(fake_prints_checkout)
    expect(exported.print_share).toBe(fake_print_share)
    expect(exported.prints_webhook).toBe(fake_prints_webhook)
    expect(exported.notification).toBe(fake_notification)
    expect(exported.prints_list).toBe(fake_prints_list)
    expect(exported.prints_reconcile).toBe(fake_prints_reconcile)
    expect(Object.keys(exported).sort()).toEqual(
      [
        'capabilities',
        'check_phone_integrity',
        'prints_checkout',
        'prints_list',
        'print_share',
        'prints_webhook',
        'prints_reconcile',
        'notification'
      ].sort()
    )
  })
})
