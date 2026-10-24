import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import InstallGuide from '@/components/install-guide.vue'

const { mock_method, mock_installed, mock_can_install, mock_prompt_install } =
  vi.hoisted(() => {
    const create_ref = value => ({ value, __v_isRef: true })
    return {
      mock_method: {
        video: 'desktop-chromium',
        label: 'Chrome · Edge · Brave',
        noun: 'desktop',
        can_prompt: true
      },
      mock_installed: create_ref(false),
      mock_can_install: create_ref(true),
      mock_prompt_install: vi.fn().mockResolvedValue('accepted')
    }
  })

vi.mock('@/use/install', () => ({
  use_install: () => ({
    method: mock_method,
    installed: mock_installed,
    can_install: mock_can_install,
    prompt_install: mock_prompt_install
  })
}))

vi.mock('@/utils/platform', () => ({
  all_methods: [
    { video: 'ios-safari', label: 'iPhone & iPad', portrait: true },
    { video: 'macos-safari', label: 'macOS Safari', portrait: false }
  ]
}))

describe('@/components/install-guide', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_installed.value = false
    mock_can_install.value = true
    mock_method.video = 'desktop-chromium'
    mock_method.label = 'Chrome · Edge · Brave'
    mock_method.noun = 'desktop'
  })

  it('shows installed messaging when already installed', () => {
    mock_installed.value = true
    const wrapper = shallowMount(InstallGuide)
    expect(wrapper.find('p[role="status"]').text()).toMatch(/is installed/i)
    expect(wrapper.find('header').exists()).toBe(false)
  })

  it('renders video and install button for the current method', async () => {
    const wrapper = shallowMount(InstallGuide)
    expect(wrapper.find('h3').text()).toContain('desktop')
    expect(wrapper.find('figure video').attributes('src')).toBe(
      '/install/desktop-chromium.mp4'
    )
    await wrapper.find('button').trigger('click')
    expect(mock_prompt_install).toHaveBeenCalled()
  })

  it('shows unsupported copy when the method has no video', () => {
    mock_method.video = null
    mock_can_install.value = false
    const wrapper = shallowMount(InstallGuide)
    expect(wrapper.find('p[role="alert"]').exists()).toBe(true)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('lists other device videos in details', () => {
    const wrapper = shallowMount(InstallGuide)
    const items = wrapper.findAll('details li')
    expect(items).toHaveLength(2)
    expect(items[0].find('h4').text()).toBe('iPhone & iPad')
    expect(items[0].find('video').attributes('src')).toBe(
      '/install/ios-safari.mp4'
    )
  })
})
