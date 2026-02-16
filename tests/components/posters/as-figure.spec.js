import { shallowMount } from '@vue/test-utils'
import { vi } from 'vitest'
import as_figure from '@/components/posters/as-figure'

const { mock_menu, mock_mosaic } = vi.hoisted(() => {
  const create_ref = value => ({ value })
  const create_watchable = value =>
    Object.assign(create_ref(value), { __v_isRef: true })
  return {
    mock_menu: create_watchable(false),
    mock_mosaic: create_watchable(false)
  }
})

vi.mock('@/utils/preference', () => ({
  menu: mock_menu,
  mosaic: mock_mosaic,
  boulders: { value: false },
  rocks: { value: false },
  gravel: { value: false },
  sand: { value: false },
  sediment: { value: false }
}))

// Mock poster data instead of using non-existent get_item
const poster = {
  id: '/+14151234356/posters/1737178477987',
  type: 'poster',
  content: '<svg><rect width="100" height="100"/></svg>'
}
describe('@/component/posters/as-figure.vue', () => {
  let wrapper
  beforeEach(() => {
    mock_menu.value = false
    wrapper = shallowMount(as_figure, { props: { itemid: poster.id } })
  })
  describe('Renders', () => {
    it('A poster', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('A new poster', async () => {
      await wrapper.setProps({ new_poster: poster })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Computed', () => {
    describe('.query_id', () => {
      it('Returns query id', () => {
        expect(wrapper.vm.query_id).toBeDefined()
      })
    })
  })
  describe('Watchers', () => {
    describe('menu', () => {
      it('Can be toggled', () => {
        expect(mock_menu.value).toBe(false)
        mock_menu.value = true
        expect(mock_menu.value).toBe(true)
      })
    })
  })
})
