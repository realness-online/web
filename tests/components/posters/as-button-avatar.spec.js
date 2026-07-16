import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import AsButtonAvatar from '@/components/posters/as-button-avatar.vue'

const { mock_me, mock_save } = vi.hoisted(() => {
  const create_ref = value => ({ value, __v_isRef: true })
  return {
    mock_me: create_ref({ avatar: undefined }),
    mock_save: vi.fn().mockResolvedValue(undefined)
  }
})

vi.mock('@/utils/serverless', () => ({
  me: mock_me
}))

vi.mock('@/use/people', () => ({
  use_me: () => ({ save: mock_save })
}))

vi.mock('@/use/poster', () => ({
  is_vector_id: () => true
}))

const itemid = '/+14151234356/posters/1000'

const mount = () =>
  shallowMount(AsButtonAvatar, {
    props: { itemid },
    global: { stubs: { icon: true } }
  })

describe('@/components/posters/as-button-avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_me.value = { avatar: undefined }
  })

  it('offers set-as-avatar when not selected', () => {
    const wrapper = mount()
    const button = wrapper.find('button')
    expect(button.attributes('aria-label')).toBe('Set as avatar')
    expect(button.attributes('aria-pressed')).toBe('false')
  })

  it('sets the avatar on click', async () => {
    const wrapper = mount()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(mock_me.value.avatar).toBe(itemid)
    expect(mock_save).toHaveBeenCalled()
  })

  it('clears the avatar when already selected', async () => {
    mock_me.value = { avatar: itemid }
    const wrapper = mount()
    expect(wrapper.find('button').attributes('aria-label')).toBe(
      'Remove as avatar'
    )
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(mock_me.value.avatar).toBeUndefined()
    expect(mock_save).toHaveBeenCalled()
  })
})
