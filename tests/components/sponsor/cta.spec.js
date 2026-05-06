import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import SponsorCta from '@/components/sponsor/cta.vue'

const { mock_me } = vi.hoisted(() => {
  const create_ref = value => ({ value, __v_isRef: true })
  return { mock_me: create_ref(undefined) }
})

vi.mock('@/utils/serverless', () => ({
  me: mock_me
}))

const BUTTON_KEY = 'VITE_STRIPE_BUY_BUTTON_ID'
const PUB_KEY = 'VITE_STRIPE_PUBLISHABLE_KEY'

const clear_stripe_scripts = () => {
  document
    .querySelectorAll('script[data-stripe-buy-button]')
    .forEach(script => script.remove())
}

describe('@/components/sponsor/cta', () => {
  let original_request_idle_callback
  let original_head_append_child
  let stripe_script_injected

  beforeEach(() => {
    vi.clearAllMocks()
    mock_me.value = { id: '/+15550000000' }
    import.meta.env[BUTTON_KEY] = 'buy_btn_test'
    import.meta.env[PUB_KEY] = 'pk_test_xyz'
    clear_stripe_scripts()
    original_request_idle_callback = window.requestIdleCallback
    window.requestIdleCallback = cb => cb()
    original_head_append_child = document.head.appendChild.bind(document.head)
    stripe_script_injected = false
    document.head.appendChild = node => {
      if (
        node instanceof HTMLScriptElement &&
        node.dataset.stripeBuyButton === 'true'
      )
        stripe_script_injected = true
      return node
    }
  })

  afterEach(() => {
    window.requestIdleCallback = original_request_idle_callback
    document.head.appendChild = original_head_append_child
    clear_stripe_scripts()
  })

  it('shows missing-link copy when env vars are unset', () => {
    import.meta.env[BUTTON_KEY] = ''
    import.meta.env[PUB_KEY] = ''
    const wrapper = shallowMount(SponsorCta)
    expect(wrapper.find('span.missing-link').exists()).toBe(true)
    expect(wrapper.find('stripe-buy-button').exists()).toBe(false)
  })

  it('renders the buy button with id, key, and client-reference-id', () => {
    const wrapper = shallowMount(SponsorCta)
    const button = wrapper.find('stripe-buy-button')
    expect(button.exists()).toBe(true)
    expect(button.attributes('buy-button-id')).toBe('buy_btn_test')
    expect(button.attributes('publishable-key')).toBe('pk_test_xyz')
    expect(button.attributes('client-reference-id')).toBe('/+15550000000')
  })

  it('omits client-reference-id when me has no id', () => {
    mock_me.value = undefined
    const wrapper = shallowMount(SponsorCta)
    const button = wrapper.find('stripe-buy-button')
    expect(button.exists()).toBe(true)
    expect(button.attributes('client-reference-id')).toBeUndefined()
  })

  it('injects the buy-button script once on mount', async () => {
    const query_selector = document.querySelector.bind(document)
    const query_spy = vi.spyOn(document, 'querySelector')
    query_spy.mockImplementation(selector => {
      if (selector === 'script[data-stripe-buy-button]')
        return stripe_script_injected ? document.createElement('script') : null
      return query_selector(selector)
    })

    const append_spy = vi.spyOn(document.head, 'appendChild')
    shallowMount(SponsorCta)
    await Promise.resolve()
    expect(append_spy).toHaveBeenCalledTimes(1)
    const script = /** @type {HTMLScriptElement} */ (
      append_spy.mock.calls[0][0]
    )
    expect(script.src).toBe('https://js.stripe.com/v3/buy-button.js')

    shallowMount(SponsorCta)
    await Promise.resolve()
    expect(append_spy).toHaveBeenCalledTimes(1)
    query_spy.mockRestore()
  })

  it('does not inject the script when env vars are missing', async () => {
    const append_spy = vi.spyOn(document.head, 'appendChild')
    import.meta.env[BUTTON_KEY] = ''
    import.meta.env[PUB_KEY] = ''
    shallowMount(SponsorCta)
    await Promise.resolve()
    expect(append_spy).not.toHaveBeenCalled()
  })
})
