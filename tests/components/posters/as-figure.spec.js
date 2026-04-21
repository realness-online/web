import { shallowMount, flushPromises } from '@vue/test-utils'
import { vi } from 'vitest'
import { get } from 'idb-keyval'
import { as_layer_id, as_query_id, load, load_from_cache } from '@/utils/itemid'
import as_menu_author from '@/components/posters/as-menu-author'
import as_figure from '@/components/posters/as-figure'

vi.mock('@/use/delegated-pan', () => ({
  use_delegated_pan: () => ({
    register: () => ({
      pan_offset: { value: 0 },
      panning: { value: false },
      was_pan_gesture: { value: false },
      unregister: vi.fn()
    })
  })
}))

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

vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/utils/itemid', async importOriginal => {
  const mod = await importOriginal()
  return {
    ...mod,
    load: vi.fn().mockResolvedValue(null),
    load_from_cache: vi.fn().mockResolvedValue({ item: null, html: null })
  }
})

// Mock poster data instead of using non-existent get_item
const poster = {
  id: '/+14151234356/posters/1737178477987',
  type: 'poster',
  content: '<svg><rect width="100" height="100"/></svg>'
}
describe('@/component/posters/as-figure.vue', () => {
  let wrapper
  const mock_key_commands = {
    add_context: vi.fn(),
    register_handler: vi.fn(),
    remove_context: vi.fn(),
    unregister_handler: vi.fn()
  }
  beforeEach(() => {
    mock_menu.value = false
    mock_mosaic.value = false
    vi.mocked(get).mockResolvedValue(null)
    vi.mocked(load_from_cache).mockResolvedValue({ item: null, html: null })
    wrapper = shallowMount(as_figure, {
      props: { itemid: poster.id },
      global: {
        provide: {
          'key-commands': mock_key_commands
        }
      }
    })
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

  describe('Shadow load recovery', () => {
    it('clears loading state when shadow load returns null', async () => {
      const vector_without_shadows = {
        id: poster.id,
        viewbox: '0 0 100 100',
        width: 100,
        height: 100
      }
      const as_svg = wrapper.findComponent({ name: 'AsSvg' })
      as_svg.vm.$emit('show', vector_without_shadows)
      await flushPromises()

      expect(wrapper.find('figure.poster').exists()).toBe(true)
    })
  })

  describe('behavior', () => {
    const poster_vector = {
      id: poster.id,
      type: 'posters',
      viewbox: '0 0 100 100',
      width: '100',
      height: '100',
      regular: true
    }

    it('emits show when vector already has regular paths', async () => {
      const as_svg = wrapper.findComponent({ name: 'AsSvg' })
      as_svg.vm.$emit('show', { ...poster_vector })
      await flushPromises()
      expect(wrapper.emitted('show')?.[0]?.[0]).toMatchObject({
        id: poster.id,
        regular: true
      })
    })

    it('fills paths from shadow html in idb when vector lacks regular', async () => {
      const shadow_id = as_layer_id(
        /** @type {import('@/types').Id} */ (poster.id),
        'shadows'
      )
      const shadow_html = `<svg itemscope itemid="${shadow_id}" itemtype="/posters" viewBox="0 0 10 10" width="10" height="10"><path itemprop="light" d="M0 0"/><path itemprop="regular" d="M0 0"/><path itemprop="medium" d="M0 0"/><path itemprop="bold" d="M0 0"/><rect itemprop="background" width="10" height="10"/></svg>`
      vi.mocked(get).mockImplementation(async key => {
        if (key === shadow_id) return shadow_html
        return null
      })
      const as_svg = wrapper.findComponent({ name: 'AsSvg' })
      as_svg.vm.$emit('show', {
        id: poster.id,
        type: 'posters',
        viewbox: '0 0 100 100',
        width: '100',
        height: '100'
      })
      await flushPromises()
      expect(wrapper.emitted('show')).toBeTruthy()
    })

    it('registers poster key commands on focusin and clears on focusout', async () => {
      const fig = wrapper.find('figure.poster')
      await fig.trigger('focusin')
      expect(mock_key_commands.add_context).toHaveBeenCalledWith('Poster')
      expect(mock_key_commands.register_handler).toHaveBeenCalled()
      await fig.trigger('focusout')
      expect(mock_key_commands.remove_context).toHaveBeenCalledWith('Poster')
      expect(mock_key_commands.unregister_handler).toHaveBeenCalledWith(
        'poster::Toggle_Meet_Slice'
      )
    })

    it('closes menu when menu prop becomes false', async () => {
      await wrapper.setProps({ menu: true })
      const as_svg = wrapper.findComponent({ name: 'AsSvg' })
      await as_svg.vm.$emit('click', true)
      await flushPromises()
      expect(wrapper.find('figcaption').exists()).toBe(true)
      await wrapper.setProps({ menu: false })
      await flushPromises()
      expect(wrapper.find('figcaption').exists()).toBe(false)
    })

    it('resets thought overlay expanded state when overlay_statements change', async () => {
      const stmts_a = [{ id: '/+14151234356/statements/1', statement: 'a' }]
      const stmts_b = [{ id: '/+14151234356/statements/2', statement: 'b' }]
      await wrapper.setProps({ menu: true, overlay_statements: stmts_a })
      const as_svg = wrapper.findComponent({ name: 'AsSvg' })
      await as_svg.vm.$emit('click', true)
      await flushPromises()
      expect(wrapper.find('figure.poster').attributes('aria-expanded')).toBe(
        'true'
      )
      await wrapper.setProps({ overlay_statements: stmts_b })
      await flushPromises()
      expect(wrapper.find('figure.poster').attributes('aria-expanded')).toBe(
        'false'
      )
    })

    it('passes pin to AsSvg so cutouts can stay mounted off-screen', () => {
      const w = shallowMount(as_figure, {
        props: { itemid: poster.id, pin: true },
        global: {
          provide: {
            'key-commands': mock_key_commands
          }
        }
      })
      expect(w.findComponent({ name: 'AsSvg' }).props('pin')).toBe(true)
    })

    it('requests cutout layers when in view and mosaic is on', async () => {
      mock_mosaic.value = true
      const sediment_id = as_layer_id(
        /** @type {import('@/types').Id} */ (poster.id),
        'sediment'
      )
      vi.mocked(get).mockImplementation(async key => {
        if (key === sediment_id) return '<svg></svg>'
        return null
      })
      const as_svg = wrapper.findComponent({ name: 'AsSvg' })
      as_svg.vm.$emit('show', { ...poster_vector, regular: true })
      await flushPromises()
      as_svg.vm.$emit('in_view', true)
      await flushPromises()
      expect(vi.mocked(get)).toHaveBeenCalledWith(sediment_id)
    })

    it('scrolls poster into view when location hash matches query id', async () => {
      const fig_el = wrapper.find('figure.poster').element
      fig_el.scrollIntoView = vi.fn()
      window.location.hash = `#${as_query_id(/** @type {import('@/types').Id} */ (poster.id))}`
      await wrapper.setProps({ slice: true })
      await flushPromises()
      expect(fig_el.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center'
      })
      window.location.hash = ''
    })

    it('loads author when menu opens', async () => {
      vi.mocked(load).mockResolvedValue({
        id: '/+14151234356',
        type: 'person',
        name: 'Test'
      })
      await wrapper.setProps({ menu: true })
      await flushPromises()
      expect(load).toHaveBeenCalled()
    })

    it('shows author menu for my poster with picker flag on poster prop', async () => {
      window.localStorage.me = '/+14151234356'
      await wrapper.setProps({ menu: true, picker_selected: true })
      const as_svg = wrapper.findComponent({ name: 'AsSvg' })
      await as_svg.vm.$emit('click', true)
      await flushPromises()
      const author_menu = wrapper.findComponent(as_menu_author)
      expect(author_menu.exists()).toBe(true)
      expect(author_menu.props('poster')).toEqual({
        id: poster.id,
        picker: true
      })
    })

    it('continues when shadow layer cache load throws', async () => {
      const shadow_id = as_layer_id(
        /** @type {import('@/types').Id} */ (poster.id),
        'shadows'
      )
      vi.mocked(get).mockResolvedValue(null)
      vi.mocked(load_from_cache).mockImplementation(async id => {
        if (id === shadow_id) throw new Error('cache_unavailable')
        return { item: null, html: null }
      })
      const as_svg = wrapper.findComponent({ name: 'AsSvg' })
      as_svg.vm.$emit('show', {
        id: poster.id,
        type: 'posters',
        viewbox: '0 0 100 100',
        width: '100',
        height: '100'
      })
      await flushPromises()
      expect(wrapper.find('figure.poster').exists()).toBe(true)
    })
  })
})
