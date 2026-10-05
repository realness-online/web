import { beforeEach as before_each, describe, expect, it, vi } from 'vitest'
import { flushPromises as flush_promises, mount } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  recaptcha: vi.fn(),
  sign_in: vi.fn()
}))

vi.mock('@/utils/firebase', async () => {
  const { ref } = await import('vue')
  return {
    init_auth: vi.fn(),
    recaptcha: mocks.recaptcha,
    sign_in: mocks.sign_in,
    current_user: ref(null)
  }
})

import AsSignOn from '@/components/as-sign-on.vue'

before_each(() => {
  vi.clearAllMocks()
  mocks.recaptcha.mockReturnValue({ type: 'recaptcha' })
  mocks.sign_in.mockResolvedValue({ confirm: mocks.confirm })
  mocks.confirm.mockResolvedValue(undefined)
})

describe('as-sign-on', () => {
  it('shows the phone form first', () => {
    const form = mount(AsSignOn)
    expect(form.find('#mobile').exists()).toBe(true)
    expect(form.find('button[type="submit"]').text()).toBe('Send code')
  })

  it('keeps Send code disabled until ten digits', async () => {
    const form = mount(AsSignOn)
    const button = form.find('button[type="submit"]')
    expect(button.attributes('disabled')).toBeDefined()

    await form.find('#mobile').setValue('5555550101')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('sends a code for the entered number', async () => {
    const form = mount(AsSignOn)
    await form.find('#mobile').setValue('(555) 555-0101')
    await form.find('form').trigger('submit')
    await flush_promises()

    expect(mocks.sign_in).toHaveBeenCalledWith('+15555550101', {
      type: 'recaptcha'
    })
    expect(form.find('#verification-code').exists()).toBe(true)
  })

  it('confirms the code and announces the sign-in', async () => {
    const form = mount(AsSignOn)
    await form.find('#mobile').setValue('5555550101')
    await form.find('form').trigger('submit')
    await flush_promises()

    await form.find('#verification-code').setValue('123456')
    await form.find('form').trigger('submit')
    await flush_promises()

    expect(mocks.confirm).toHaveBeenCalledWith('123456')
    expect(form.emitted('signed_in')).toHaveLength(1)
    expect(form.text()).toContain('Signed in.')
  })

  it('reports a bad code without losing the form', async () => {
    mocks.confirm.mockRejectedValue(new Error('bad code'))
    const form = mount(AsSignOn)
    await form.find('#mobile').setValue('5555550101')
    await form.find('form').trigger('submit')
    await flush_promises()

    await form.find('#verification-code').setValue('000000')
    await form.find('form').trigger('submit')
    await flush_promises()

    expect(form.find('[role="alert"]').text()).toContain('incorrect')
    expect(form.find('#verification-code').exists()).toBe(true)
  })
})
