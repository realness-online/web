import { shallowMount, flushPromises } from '@vue/test-utils'
import { nextTick, defineComponent, h } from 'vue'
import { vi } from 'vite-plus/test'
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

const {
  mock_menu,
  mock_mosaic,
  mock_enable_geology,
  mock_export_video,
  mock_decode_audio,
  mock_am_canonical,
  mock_is_referenced,
  mock_use_reference
} = vi.hoisted(() => {
  const create_ref = value => ({ value })
  const create_watchable = value =>
    Object.assign(create_ref(value), { __v_isRef: true })
  return {
    mock_menu: create_watchable(false),
    mock_mosaic: create_watchable(false),
    mock_enable_geology: vi.fn(),
    mock_export_video: vi.fn().mockResolvedValue(undefined),
    mock_decode_audio: vi
      .fn()
      .mockResolvedValue([{ buffer: new ArrayBuffer(1) }]),
    mock_am_canonical: create_watchable(false),
    mock_is_referenced: create_watchable(false),
    mock_use_reference: create_watchable(false)
  }
})

vi.mock('@/utils/preference', () => ({
  menu: mock_menu,
  mosaic: mock_mosaic,
  view_3d: { value: false },
  boulders: { value: false },
  rocks: { value: false },
  gravel: { value: false },
  sand: { value: false },
  sediment: { value: false },
  enable_geology_layers: mock_enable_geology
}))

vi.mock('@/utils/export-poster-video', () => ({
  export_poster_to_video_with_audio: mock_export_video
}))

vi.mock('@/use/poster-instances', () => ({
  use_poster_instance: () => ({
    am_canonical: mock_am_canonical,
    is_referenced: mock_is_referenced,
    use_reference: mock_use_reference
  })
}))

vi.mock('@/utils/audio-file', async importOriginal => {
  const mod = await importOriginal()
  return { ...mod, decode_audio_files: mock_decode_audio }
})

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
  id: '/+14151234356/posters/1770000000000',
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
    mock_enable_geology.mockClear()
    mock_export_video.mockClear()
    mock_decode_audio.mockClear()
    mock_am_canonical.value = false
    mock_is_referenced.value = false
    mock_use_reference.value = false
    vi.mocked(get).mockResolvedValue(null)
    // Queued `mockResolvedValueOnce` values outlive the test that set them and
    // get eaten by whoever loads next, so each test starts from nothing found.
    vi.mocked(load).mockReset().mockResolvedValue(null)
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
    describe('overlay_text_visible', () => {
      it('is false with no overlay statements', () => {
        expect(wrapper.vm.overlay_text_visible).toBe(false)
      })
    })
    describe('figcaption_visible', () => {
      it('is false in the default closed state', () => {
        expect(wrapper.vm.figcaption_visible).toBe(false)
      })
    })
    describe('.poster_label', () => {
      it('builds a label from the poster created timestamp', () => {
        expect(wrapper.vm.poster_label).toContain('Poster from')
      })
    })
    describe('.poster_time', () => {
      it('derives a time from the poster created timestamp', () => {
        expect(wrapper.vm.poster_time).toBeTruthy()
      })
    })
    describe('.profile_chip_itemid', () => {
      it('is the itemid for label display', () => {
        expect(wrapper.vm.profile_chip_itemid).toBe(poster.id)
      })
      it('is undefined for phonebook display', async () => {
        const w = shallowMount(as_figure, {
          props: { itemid: poster.id, profile_display: 'phonebook' },
          global: {
            provide: { 'key-commands': mock_key_commands }
          }
        })
        expect(w.vm.profile_chip_itemid).toBeUndefined()
        w.unmount()
      })
    })
    describe('.has_remove_handler', () => {
      it('is false when no remove handler is passed', () => {
        expect(wrapper.vm.has_remove_handler).toBe(false)
      })
    })
    describe('.is_my_poster', () => {
      it('is true when the author is the local user', () => {
        const w = shallowMount(as_figure, {
          props: { itemid: poster.id },
          global: {
            provide: { 'key-commands': mock_key_commands }
          }
        })
        // author of poster.id is /+14151234356
        Object.defineProperty(window, 'localStorage', {
          value: { me: '/+14151234356' },
          configurable: true,
          writable: true
        })
        expect(w.vm.is_my_poster).toBe(true)
        w.unmount()
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

      expect(wrapper.find('figure').exists()).toBe(true)
    })
  })

  /**
   * `missing` is answered by deleting the poster from storage - its html, its
   * shadow, every geology layer. `show` in use/poster fires with whatever
   * `vector` happens to hold, so a render that races the load reports empty for
   * a poster that is perfectly well there, and the poster vanished off the
   * screen mid-edit. An empty show has to be confirmed before anything is
   * deleted.
   */
  describe('An empty show', () => {
    const emit_empty_show = async () => {
      wrapper.findComponent({ name: 'AsSvg' }).vm.$emit('show', null)
      await flushPromises()
    }

    it('does not report missing while the poster is still loadable', async () => {
      vi.mocked(load).mockResolvedValue({
        id: poster.id,
        type: 'posters',
        viewbox: '0 0 100 100',
        width: '100',
        height: '100',
        regular: true
      })
      await emit_empty_show()
      expect(wrapper.emitted('missing')).toBeFalsy()
    })

    it('reports missing once a finished load comes back with nothing', async () => {
      vi.mocked(load).mockResolvedValue(null)
      await emit_empty_show()
      expect(wrapper.emitted('missing')?.[0]).toEqual([poster.id])
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

    it('emits show for a pre-2020-11 poster that has no regular layer', async () => {
      // Posters from before 2020-11-24 only ever drew with background and bold.
      // No shadow file exists to fill `regular` in, so gating show on it left
      // these loading forever and timing out under folder sync.
      vi.mocked(get).mockResolvedValue(null)
      vi.mocked(load_from_cache).mockResolvedValue({ item: null, html: null })
      const as_svg = wrapper.findComponent({ name: 'AsSvg' })
      as_svg.vm.$emit('show', {
        id: poster.id,
        type: 'posters',
        viewbox: '0 0 100 100',
        width: '100',
        height: '100',
        background: {},
        bold: {}
      })
      await flushPromises()
      expect(wrapper.emitted('show')?.[0]?.[0]).toMatchObject({
        id: poster.id,
        bold: {}
      })
    })

    it('registers poster key commands on focusin and clears on focusout', async () => {
      const fig = wrapper.find('figure')
      await fig.trigger('focusin')
      expect(mock_key_commands.add_context).toHaveBeenCalledWith('Poster')
      expect(mock_key_commands.register_handler).toHaveBeenCalled()
      await fig.trigger('focusout')
      expect(mock_key_commands.remove_context).toHaveBeenCalledWith('Poster')
      expect(mock_key_commands.unregister_handler).toHaveBeenCalledWith(
        'poster::Toggle_Meet_Slice'
      )
    })

    it('allows a drag over a poster when it carries an audio file', () => {
      const fig = wrapper.find('figure').element
      const audio = new File(['x'], 'clip.mp3', { type: 'audio/mp3' })
      const event = new Event('dragover', { cancelable: true, bubbles: true })
      Object.defineProperty(event, 'dataTransfer', {
        value: { files: [audio] }
      })
      fig.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    })

    it('ignores a drag over a poster with non-audio files', () => {
      const fig = wrapper.find('figure').element
      const text = new File(['x'], 'notes.txt', { type: 'text/plain' })
      const event = new Event('dragover', { cancelable: true, bubbles: true })
      Object.defineProperty(event, 'dataTransfer', {
        value: { files: [text] }
      })
      fig.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
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

    it('hides read-only overlay statements until the poster is clicked', async () => {
      const stmts = [{ id: '/+14151234356/statements/1', statement: 'hello' }]
      await wrapper.setProps({
        overlay_statements: stmts,
        overlay_editable: false,
        menu: false
      })
      await flushPromises()
      expect(wrapper.find('figcaption aside').exists()).toBe(false)
      const as_svg = wrapper.findComponent({ name: 'AsSvg' })
      await as_svg.vm.$emit('click', true)
      await flushPromises()
      expect(wrapper.find('figcaption aside').exists()).toBe(true)
    })

    // Enter on a poster toggles meet/slice, and toggling it emits the same
    // click that opens and closes the thought overlay. Pressing Enter while
    // writing in that overlay therefore shut the overlay under the caret - and
    // the statement went with it.
    it('leaves the poster alone when enter comes from an editable statement', async () => {
      const stmts = [{ id: '/+14151234356/statements/1', statement: 'hello' }]
      // The real AsSvg answers `toggle_meet` by emitting the click that opens
      // and closes the overlay. A stub without it cannot show this at all.
      const as_svg_stub = defineComponent({
        name: 'AsSvg',
        emits: ['click', 'show'],
        setup(_props, { emit, expose }) {
          expose({ toggle_meet: () => emit('click', true) })
          return () => h('svg')
        }
      })
      const w = shallowMount(as_figure, {
        props: {
          itemid: poster.id,
          overlay_statements: stmts,
          overlay_editable: true,
          menu: false
        },
        global: {
          provide: { 'key-commands': mock_key_commands },
          stubs: { AsSvg: as_svg_stub }
        }
      })
      const as_svg = w.findComponent({ name: 'AsSvg' })
      await as_svg.vm.$emit('click', true)
      await flushPromises()
      expect(w.find('figcaption aside').exists()).toBe(true)

      const editor = document.createElement('p')
      editor.setAttribute('contenteditable', 'true')
      w.find('figcaption aside').element.append(editor)

      editor.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      )
      await flushPromises()

      expect(w.find('figcaption aside').exists()).toBe(true)

      // Enter anywhere else on the poster still toggles it, and the toggle is
      // what closes the overlay.
      w.find('figure').element.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      )
      await flushPromises()
      expect(w.find('figcaption aside').exists()).toBe(false)
      w.unmount()
    })

    // An emptied statement is one line tall inside a panel several lines tall,
    // so nearly every attempt to click back into it lands on the panel and does
    // nothing. The panel is what you aim at, so the panel is what opens it.
    it('opens the editor when the overlay panel itself is clicked', async () => {
      const touch_match_media = window.matchMedia
      window.matchMedia = vi.fn(query => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
      const stmts = [
        { id: '/+14151234356/statements/1770000000001', statement: '' }
      ]
      const w = shallowMount(as_figure, {
        props: {
          itemid: poster.id,
          overlay_statements: stmts,
          overlay_editable: true,
          menu: false
        },
        global: {
          provide: {
            'key-commands': mock_key_commands,
            update_statement: vi.fn()
          },
          stubs: { AsThought: false }
        }
      })
      await w.findComponent({ name: 'AsSvg' }).vm.$emit('click', true)
      await flushPromises()

      const aside = w.find('figcaption aside')
      expect(aside.exists()).toBe(true)
      await aside.trigger('click')
      await flushPromises()

      expect(w.find('[contenteditable="true"]').exists()).toBe(true)
      w.unmount()
      window.matchMedia = touch_match_media
    })

    it('leaves a read-only overlay panel alone', async () => {
      const stmts = [
        { id: '/+14151234356/statements/1770000000001', statement: '' }
      ]
      const w = shallowMount(as_figure, {
        props: {
          itemid: poster.id,
          overlay_statements: stmts,
          overlay_editable: false,
          menu: false
        },
        global: {
          provide: {
            'key-commands': mock_key_commands,
            update_statement: vi.fn()
          },
          stubs: { AsThought: false }
        }
      })
      await w.findComponent({ name: 'AsSvg' }).vm.$emit('click', true)
      await flushPromises()
      await w.find('figcaption aside').trigger('click')
      await flushPromises()

      expect(w.find('[contenteditable="true"]').exists()).toBe(false)
      w.unmount()
    })

    it('keeps the caption out of the haptic label', async () => {
      const stmts = [{ id: '/+14151234356/statements/1', statement: 'hello' }]
      await wrapper.setProps({ overlay_statements: stmts, menu: false })
      const as_svg = wrapper.findComponent({ name: 'AsSvg' })
      await as_svg.vm.$emit('click', true)
      await flushPromises()
      const figcaption = wrapper.find('figcaption')
      expect(figcaption.exists()).toBe(true)
      expect(figcaption.element.closest('label')).toBe(null)
    })

    it('resets thought overlay expanded state when overlay_statements change', async () => {
      const stmts_a = [{ id: '/+14151234356/statements/1', statement: 'a' }]
      const stmts_b = [{ id: '/+14151234356/statements/2', statement: 'b' }]
      await wrapper.setProps({
        menu: true,
        overlay_statements: stmts_a,
        overlay_editable: true
      })
      const as_svg = wrapper.findComponent({ name: 'AsSvg' })
      await as_svg.vm.$emit('click', true)
      await flushPromises()
      expect(wrapper.find('figure').attributes('aria-expanded')).toBe('true')
      await wrapper.setProps({ overlay_statements: stmts_b })
      await flushPromises()
      expect(wrapper.find('figure').attributes('aria-expanded')).toBe('false')
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

    it('builds cutout layer ids from poster created id in paged paths', () => {
      const archived_poster_id = /** @type {import('@/types').Id} */ (
        '/+14151234356/posters/1773370923007/1773358870964'
      )
      const layer_id = as_layer_id(archived_poster_id, 'sand')
      expect(layer_id).toBe('/+14151234356/sand/1773358870964')
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
      await wrapper.setProps({ pin: true })
      await flushPromises()
      expect(vi.mocked(get)).toHaveBeenCalledWith(sediment_id)
    })

    it('scrolls poster into view when location hash matches query id', async () => {
      const fig_el = wrapper.find('figure').element
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
      expect(wrapper.find('figure').exists()).toBe(true)
    })

    describe('mask pen subject list', () => {
      it('renders the named subjects with swatch, rename and guarded remove', async () => {
        const subject = wrapper.vm.mask_pen.add_subject('Flower')
        wrapper.vm.mask_pen.active.value = true
        await nextTick()
        const list = wrapper.find('menu.mask-panel')
        expect(list.exists()).toBe(true)
        const rows = list.findAll('li')
        expect(rows).toHaveLength(2) // one subject + one add
        expect(rows[0].text()).toContain('Flower')
        expect(rows[0].find('.mask-swatch').exists()).toBe(true)
        expect(rows[0].find('input').exists()).toBe(true)
        expect(rows[0].find('[aria-label*="Flower"]').exists()).toBe(true)
        // Rename updates the persisted subject name.
        await rows[0].find('input').setValue('Rose')
        expect(
          wrapper.vm.mask_pen.subjects.value.find(s => s.id === subject.id).name
        ).toBe('Rose')
        // First remove click arms the confirm; the subject survives.
        await rows[0].find('[aria-label*="Rose"]').trigger('click')
        expect(
          wrapper.vm.mask_pen.subjects.value.find(s => s.id === subject.id)
        ).toBeDefined()
        expect(wrapper.vm.mask_pen.pending_removal_id.value).toBe(subject.id)
        // The armed button asks for confirmation; clicking again removes.
        expect(rows[0].find('[aria-label*="Confirm remove"]').exists()).toBe(
          true
        )
        await rows[0].find('[aria-label*="Confirm remove"]').trigger('click')
        expect(
          wrapper.vm.mask_pen.subjects.value.find(s => s.id === subject.id)
        ).toBeUndefined()
      })
    })

    describe('mask pen toggle', () => {
      it('turns on mosaic and geology layers, closes menu; turning off does neither', async () => {
        expect(wrapper.vm.mask_pen.active.value).toBe(false)
        wrapper.vm.menu_open = true
        wrapper.vm.on_toggle_mask_pen()
        await nextTick()
        expect(wrapper.vm.mask_pen.active.value).toBe(true)
        expect(mock_mosaic.value).toBe(true)
        expect(mock_enable_geology).toHaveBeenCalledTimes(1)
        expect(wrapper.vm.menu_open).toBe(false)

        wrapper.vm.on_toggle_mask_pen()
        await nextTick()
        expect(wrapper.vm.mask_pen.active.value).toBe(false)
        expect(mock_enable_geology).toHaveBeenCalledTimes(1)
      })

      it('does not force mosaic on when geology is already on', async () => {
        wrapper.vm.mask_pen.active.value = true
        wrapper.vm.on_toggle_mask_pen()
        await nextTick()
        expect(mock_enable_geology).not.toHaveBeenCalled()
      })

      it('closes the mask pen when clicking outside the poster', async () => {
        wrapper.vm.mask_pen.toggle_active()
        await nextTick()
        expect(wrapper.vm.mask_pen.active.value).toBe(true)
        window.dispatchEvent(new Event('pointerdown'))
        await nextTick()
        expect(wrapper.vm.mask_pen.active.value).toBe(false)
      })
    })

    it('emits missing when a geology-era poster has no cutout layers', async () => {
      mock_mosaic.value = true
      const as_svg = wrapper.findComponent({ name: 'AsSvg' })
      as_svg.vm.$emit('show', { ...poster_vector, regular: true })
      await flushPromises()
      await wrapper.setProps({ pin: true })
      await flushPromises()
      // created (1770000000000) > GEOLOGY_DATE, no cutouts found -> stale entry
      expect(wrapper.emitted('missing')?.[0]?.[0]).toBe(poster.id)
    })

    // Plenty of posters simply have no cutout layers. Deleting one for that is
    // how a poster vanished off the feed - and out of storage - mid-edit.
    it('keeps a poster with no cutout layers that still loads', async () => {
      vi.mocked(load).mockResolvedValue({ ...poster_vector })
      mock_mosaic.value = true
      const as_svg = wrapper.findComponent({ name: 'AsSvg' })
      as_svg.vm.$emit('show', { ...poster_vector, regular: true })
      await flushPromises()
      await wrapper.setProps({ pin: true })
      await flushPromises()
      expect(wrapper.emitted('missing')).toBeFalsy()
    })

    it('exports a video with audio dropped on the bare poster', async () => {
      const fig = wrapper.find('figure').element
      const audio = new File(['x'], 'clip.mp3', { type: 'audio/mp3' })
      const event = new Event('drop', { cancelable: true, bubbles: true })
      Object.defineProperty(event, 'dataTransfer', {
        value: { files: [audio] }
      })
      fig.dispatchEvent(event)
      await flushPromises()
      expect(mock_decode_audio).toHaveBeenCalledTimes(1)
      expect(mock_export_video).toHaveBeenCalledWith(
        poster.id,
        expect.objectContaining({
          audio_buffers: [{ buffer: expect.any(ArrayBuffer) }]
        })
      )
    })

    it('ignores a drop with no audio files', async () => {
      const fig = wrapper.find('figure').element
      const text = new File(['x'], 'notes.txt', { type: 'text/plain' })
      const event = new Event('drop', { cancelable: true, bubbles: true })
      Object.defineProperty(event, 'dataTransfer', { value: { files: [text] } })
      fig.dispatchEvent(event)
      await flushPromises()
      expect(mock_decode_audio).not.toHaveBeenCalled()
      expect(mock_export_video).not.toHaveBeenCalled()
    })

    describe('dom-reference (non-canonical duplicate instance)', () => {
      const dom_id = () =>
        as_query_id(/** @type {import('@/types').Id} */ (poster.id))
      const mount_reference = async () => {
        mock_use_reference.value = true
        const w = shallowMount(as_figure, {
          props: { itemid: poster.id },
          global: { provide: { 'key-commands': mock_key_commands } }
        })
        await flushPromises()
        return w
      }

      it('renders a reference svg to the canonical and syncs its geometry', async () => {
        // A fake canonical render already in the DOM (namespaced so tagName is 'svg')
        const canonical = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'svg'
        )
        canonical.id = dom_id()
        canonical.setAttribute('viewBox', '0 0 40 20')
        canonical.setAttribute('preserveAspectRatio', 'xMidYMax slice')
        canonical.setAttribute('data-orientation', 'horizontal')
        document.body.appendChild(canonical)

        const ref_wrapper = await mount_reference()
        const ref_svg = ref_wrapper.find('svg[itemtype="/posters"]')
        expect(ref_svg.exists()).toBe(true)
        expect(ref_svg.attributes('viewBox')).toBe('0 0 40 20')
        expect(ref_svg.attributes('preserveAspectRatio')).toBe('xMidYMax slice')
        expect(ref_svg.attributes('data-orientation')).toBe('horizontal')
        expect(ref_svg.find('use').attributes('href')).toBe(`#${dom_id()}`)

        canonical.remove()
        ref_wrapper.unmount()
      })

      it('dispatches the meet toggle on the shared reference element', async () => {
        const ref_wrapper = await mount_reference()
        const event_spy = vi.fn()
        document.addEventListener('poster-toggle-meet-only', event_spy)
        await ref_wrapper.find('figure').trigger('keydown.enter')
        expect(event_spy).toHaveBeenCalledTimes(1)
        document.removeEventListener('poster-toggle-meet-only', event_spy)
        ref_wrapper.unmount()
      })
    })
  })
})
