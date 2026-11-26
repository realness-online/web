import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { mount, flushPromises } from '@vue/test-utils'
import AsFieldsetOrgs from '@/components/account/as-fieldset-orgs'

vi.mock('@/utils/settled-user', () => ({
  settled_token: vi.fn(() => Promise.resolve('token'))
}))

const { mock_me } = vi.hoisted(() => ({
  mock_me: { value: { name: 'Scott', id: '/+16282281824' }, __v_isRef: true }
}))

vi.mock('@/utils/serverless', () => ({ me: mock_me }))

const answer = body =>
  Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))

const sms = {
  name: '+share-more-stories',
  title: 'Share More Stories',
  short: 'SMS',
  url: 'https://sharemorestories.com/',
  founder: '+16282281824',
  people: [
    { name: 'Scott', phone: '+16282281824', role: 'founder' },
    { name: 'Christian Warren', phone: '+18622535338', role: 'member' },
    { name: '', phone: '+442079460958', role: 'member' }
  ]
}

describe('as-fieldset-orgs', () => {
  let orgs
  beforeEach(() => {
    orgs = [sms]
    globalThis.fetch = vi.fn(() => answer({ orgs }))
  })

  it('shows each org by name, short name, and icon', async () => {
    const wrapper = mount(AsFieldsetOrgs)
    await flushPromises()
    expect(wrapper.find('h5[itemprop="name"]').text()).toBe(
      'Share More Stories'
    )
    expect(wrapper.find('[itemprop="alternateName"]').text()).toBe('SMS')
    expect(wrapper.find('img[itemprop="logo"]').attributes('src')).toBe(
      'https://sharemorestories.com/favicon.ico'
    )
  })

  it('titles a folder name when the page has no name', async () => {
    orgs = [{ name: '+family', people: [] }]
    const wrapper = mount(AsFieldsetOrgs)
    await flushPromises()
    expect(wrapper.find('h5[itemprop="name"]').text()).toBe('Family')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('lists people with formatted phones; the founder is marked', async () => {
    const wrapper = mount(AsFieldsetOrgs)
    await flushPromises()
    expect(wrapper.find('[itemprop="founder"] [itemprop="name"]').text()).toBe(
      'Scott'
    )
    expect(
      wrapper.findAll('[itemprop="telephone"]').map(phone => phone.text())
    ).toEqual(['(628) 228-1824', '(862) 253-5338', '+44 20 7946 0958'])
  })

  it('shows nothing when I am in no org', async () => {
    orgs = []
    const wrapper = mount(AsFieldsetOrgs)
    await flushPromises()
    expect(wrapper.find('fieldset').exists()).toBe(false)
  })

  it('sh8: an admin makes an org from the account page', async () => {
    globalThis.fetch = vi.fn((url, options) =>
      options?.method === 'POST'
        ? answer({ name: '+family-fun' })
        : answer({ orgs, admin: true })
    )
    const wrapper = mount(AsFieldsetOrgs)
    await flushPromises()
    await wrapper.find('#new-org input').setValue('Family Fun')
    await wrapper.find('#new-org').trigger('submit')
    await flushPromises()
    const posted = globalThis.fetch.mock.calls.find(
      ([, options]) => options?.method === 'POST'
    )
    expect(posted[0]).toBe('/v1/orgs')
    expect(JSON.parse(posted[1].body)).toEqual({
      name: '+family-fun',
      founder_name: 'Scott'
    })
  })

  it('sh8: only the network admin is offered a new org', async () => {
    globalThis.fetch = vi.fn(() => answer({ orgs, admin: false }))
    const wrapper = mount(AsFieldsetOrgs)
    await flushPromises()
    expect(wrapper.find('#new-org').exists()).toBe(false)
  })

  it('sh8: the founder adds a member with a phone stored as +digits', async () => {
    globalThis.fetch = vi.fn((url, options) =>
      options?.method === 'POST' ? answer({ members: [] }) : answer({ orgs })
    )
    const wrapper = mount(AsFieldsetOrgs)
    await flushPromises()
    const form = wrapper.find('#add-member-share-more-stories')
    await form.find('input[autocomplete="name"]').setValue('Kit')
    await form.find('input[type="tel"]').setValue('(862) 253-5338')
    await form.trigger('submit')
    await flushPromises()
    const posted = globalThis.fetch.mock.calls.find(
      ([, options]) => options?.method === 'POST'
    )
    expect(posted[0]).toBe('/v1/orgs/+share-more-stories/members')
    expect(JSON.parse(posted[1].body)).toEqual({
      add: [{ name: 'Kit', phone: '+18622535338' }]
    })
  })

  it('sh8: a member who is not the founder cannot add people', async () => {
    globalThis.fetch = vi.fn(() => answer({ orgs }))
    mock_me.value = { name: 'Ava', id: '/+15555550101' }
    const wrapper = mount(AsFieldsetOrgs)
    await flushPromises()
    expect(wrapper.find('#add-member-share-more-stories').exists()).toBe(false)
    mock_me.value = { name: 'Scott', id: '/+16282281824' }
  })

  it('sh7: the founder hands the org to a member after confirming', async () => {
    globalThis.fetch = vi.fn((url, options) =>
      options?.method === 'POST' ? answer({}) : answer({ orgs })
    )
    HTMLDialogElement.prototype.showModal ??= vi.fn()
    HTMLDialogElement.prototype.close ??= vi.fn()
    const wrapper = mount(AsFieldsetOrgs, { attachTo: document.body })
    await flushPromises()
    const form = wrapper.find('#hand-over-share-more-stories')
    await form.find('select').setValue('+18622535338')
    await form.trigger('submit')
    expect(
      globalThis.fetch.mock.calls.some(
        ([, options]) => options?.method === 'POST'
      )
    ).toBe(false)
    expect(wrapper.find('#confirm-hand-over p').text()).toContain(
      'Christian Warren'
    )
    await wrapper.find('#confirm-hand-over #confirm').trigger('click')
    await flushPromises()
    const posted = globalThis.fetch.mock.calls.find(
      ([, options]) => options?.method === 'POST'
    )
    expect(posted[0]).toBe('/v1/orgs/+share-more-stories/owner')
    expect(JSON.parse(posted[1].body)).toEqual({
      phone: '+18622535338',
      confirm: '+share-more-stories'
    })
    wrapper.unmount()
  })
})
