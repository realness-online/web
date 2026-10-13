import { describe, it, expect, vi } from 'vitest'

const {
  fake_capabilities,
  fake_check_phone_integrity,
  fake_prints_checkout,
  fake_print_share,
  fake_prints_webhook,
  fake_notification
} = vi.hoisted(() => ({
  fake_capabilities: { name: 'capabilities' },
  fake_check_phone_integrity: { name: 'check_phone_integrity' },
  fake_prints_checkout: { name: 'prints_checkout' },
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
vi.mock('#handlers/storage/mirror-names.js', () => ({
  mirror_names_written: { name: 'mirror_names_written' },
  mirror_names_deleted: { name: 'mirror_names_deleted' },
  mirror_names_archived: { name: 'mirror_names_archived' }
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
    expect(exported.mirror_names_written.name).toBe('mirror_names_written')
    expect(exported.mirror_names_deleted.name).toBe('mirror_names_deleted')
    expect(exported.mirror_names_archived.name).toBe('mirror_names_archived')
  })
})
