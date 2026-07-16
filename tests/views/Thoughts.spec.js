import { describe, it, expect, beforeEach, afterEach, vi } from 'vite-plus/test'
import { ref, nextTick, defineComponent, h } from 'vue'
import { shallowMount, flushPromises } from '@vue/test-utils'
import Thoughts from '@/views/Thoughts.vue'
import { del } from 'idb-keyval'
import { posting, scroll_position } from '@/use/posting'
import { storytelling, only_mine } from '@/utils/preference'

const poster_id = '/+14151234356/posters/1000'
const person_id = '/+14151234356'

const {
  mock_current_user_ref,
  mock_load,
  mock_poster_delete,
  mock_clear_author_dirs,
  mock_load_directory_from_network,
  mock_register,
  mock_select_photo,
  mock_set_working,
  mock_init_processing_queue,
  mock_queue_items,
  mock_people,
  mock_phonebook,
  mock_load_phonebook,
  mock_posters,
  mock_posters_for_person,
  mock_statements,
  mock_statements_for_person,
  mock_statement_shown,
  mock_poster_shown,
  mock_storytelling,
  mock_only_mine,
  mock_aspect_ratio_mode,
  mock_menu,
  mock_feed_on_refresh
} = vi.hoisted(() => {
  const { ref } = require('vue')
  const create_ref = value => ({ value, __v_isRef: true })
  return {
    mock_current_user_ref: ref({ uid: 'test-user' }),
    mock_load: vi.fn(),
    mock_poster_delete: vi.fn().mockResolvedValue(undefined),
    mock_clear_author_dirs: vi.fn().mockResolvedValue(undefined),
    mock_load_directory_from_network: vi.fn().mockResolvedValue({
      items: [1000, 2000]
    }),
    mock_register: vi.fn(),
    mock_select_photo: vi.fn(),
    mock_set_working: vi.fn(),
    mock_init_processing_queue: vi.fn().mockResolvedValue(undefined),
    mock_queue_items: create_ref([]),
    mock_people: create_ref([]),
    mock_phonebook: create_ref([
      { id: '/+14151234356/people/1', type: 'person' }
    ]),
    mock_load_phonebook: vi.fn().mockResolvedValue(undefined),
    mock_posters: create_ref([]),
    mock_posters_for_person: vi.fn().mockResolvedValue(undefined),
    mock_statements: create_ref([]),
    mock_statements_for_person: vi.fn().mockResolvedValue(undefined),
    mock_statement_shown: vi.fn(),
    mock_poster_shown: vi.fn(),
    mock_storytelling: ref(false),
    mock_only_mine: ref(false),
    mock_aspect_ratio_mode: ref('auto'),
    mock_menu: ref(true),
    mock_feed_on_refresh: { value: null }
  }
})

vi.mock('@/utils/serverless', () => ({
  get current_user() {
    return mock_current_user_ref
  },
  directory: vi.fn().mockResolvedValue({ items: [], prefixes: [] }),
  url: vi.fn().mockResolvedValue(null),
  me: { value: undefined }
}))

vi.mock('@/utils/itemid', async import_original => {
  const actual = await import_original()
  return {
    ...actual,
    load: (...args) => mock_load(...args)
  }
})

vi.mock('@/persistence/Storage', () => ({
  Poster: class {
    constructor(id) {
      this.id = id
    }
    delete(...args) {
      return mock_poster_delete(...args)
    }
  }
}))

vi.mock('@/persistence/Directory', async import_original => {
  const actual = await import_original()
  return {
    ...actual,
    clear_author_dirs: (...args) => mock_clear_author_dirs(...args),
    load_directory_from_network: (...args) =>
      mock_load_directory_from_network(...args)
  }
})

vi.mock('@/use/key-commands', () => ({
  use_keymap: () => ({ register: mock_register })
}))

vi.mock('@/use/people', () => ({
  use: () => ({
    people: mock_people,
    phonebook: mock_phonebook,
    load_phonebook: mock_load_phonebook
  }),
  get_my_itemid: vi.fn(type => `/+14151234356/${type}`),
  is_person: maybe =>
    typeof maybe === 'object' && maybe?.type === 'person' && !!maybe.id
}))

vi.mock('@/use/poster', () => ({
  use_posters: () => ({
    for_person: mock_posters_for_person,
    poster_shown: mock_poster_shown,
    posters: mock_posters
  }),
  geology_layers: ['sediment', 'sand', 'gravel', 'rocks', 'boulders'],
  is_vector_id: vi.fn(() => true),
  is_svg_valid: vi.fn(() => true),
  is_url_query: vi.fn(() => true),
  is_rect: vi.fn(() => true),
  is_vector: vi.fn(() => true),
  is_focus: vi.fn(() => true),
  is_click: vi.fn(() => true)
}))

vi.mock('@/use/statements', () => ({
  use: () => ({
    statements: mock_statements,
    my_statements: mock_statements,
    statement_shown: mock_statement_shown,
    for_person: mock_statements_for_person,
    update_statement: vi.fn()
  }),
  poster_thought_overlay_pairs: () => ({
    pairs: new Map(),
    merged_thought_keys: new Set()
  })
}))

vi.mock('@/use/feed', () => ({
  use_feed: ({ statements_for_person, posters_for_person, on_refresh }) => {
    mock_feed_on_refresh.value = on_refresh
    return {
      load_feed_for_people: vi.fn(async (people_ids = []) => {
        await Promise.all(
          people_ids.map(async id => {
            await Promise.all([
              statements_for_person({ id }),
              posters_for_person({ id })
            ])
          })
        )
      }),
      is_editable: () => true,
      overlay_for_day: () => ({ merged_thought_keys: new Set() }),
      overlay_statements_for_poster: () => [],
      overlay_editable_for_poster: () => false
    }
  }
}))

vi.mock('@/utils/preference', () => ({
  storytelling: mock_storytelling,
  aspect_ratio_mode: mock_aspect_ratio_mode,
  menu: mock_menu,
  only_mine: mock_only_mine
}))

vi.mock('@/utils/after-layout', () => ({
  after_layout: () => Promise.resolve()
}))

Object.defineProperty(window, 'localStorage', {
  value: { me: person_id },
  writable: true
})

vi.spyOn(console, 'time').mockImplementation(() => {})
vi.spyOn(console, 'timeEnd').mockImplementation(() => {})

const day_items = [{ id: poster_id, type: 'posters' }]

const AsDaysStub = defineComponent({
  name: 'AsDays',
  props: ['working', 'posters', 'statements', 'storytelling'],
  setup(_, { slots }) {
    return () =>
      h(
        'section',
        { class: 'as-days-stub' },
        slots.default ? slots.default({ day: day_items }) : []
      )
  }
})

const stubs = {
  icon: true,
  'logo-as-link': true,
  'as-textarea': {
    name: 'AsTextarea',
    emits: ['toggle-keyboard', 'tab-next'],
    template: '<div class="as-textarea-stub" />'
  },
  'as-feed-toggle': {
    name: 'AsFeedToggle',
    props: ['modelValue'],
    template: '<div class="as-feed-toggle-stub" />'
  },
  'as-svg-processing': {
    name: 'AsSvgProcessing',
    props: ['queue_item'],
    template: '<figure class="processing-stub" />'
  },
  'as-days': AsDaysStub,
  'as-article': {
    name: 'AsArticle',
    template: '<article class="article-stub" />',
    props: ['statements', 'verbose'],
    emits: ['show']
  },
  'as-figure': {
    name: 'AsFigure',
    template:
      '<figure class="poster-stub" tabindex="-1"><svg itemscope itemtype="/posters" :itemid="itemid"></svg></figure>',
    props: [
      'itemid',
      'menu',
      'slice',
      'overlay_statements',
      'overlay_editable'
    ],
    emits: ['show', 'remove', 'missing']
  },
  'router-link': {
    props: ['to'],
    template: '<a :href="to"><slot /></a>'
  }
}

const mount = (overrides = {}) =>
  shallowMount(Thoughts, {
    attachTo: document.body,
    global: {
      provide: {
        set_working: mock_set_working,
        select_photo: mock_select_photo,
        register_account: vi.fn(),
        init_processing_queue: mock_init_processing_queue,
        queue_items: mock_queue_items,
        ...overrides.provide
      },
      stubs: { ...stubs, ...overrides.stubs }
    }
  })

const settled = async wrapper => {
  await flushPromises()
  await nextTick()
  await flushPromises()
  return wrapper
}

describe('Thoughts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    mock_current_user_ref.value = { uid: 'test-user' }
    mock_statements.value = []
    mock_people.value = []
    mock_posters.value = [{ id: poster_id, type: 'posters' }]
    mock_phonebook.value = [{ id: '/+14151234356/people/1', type: 'person' }]
    mock_queue_items.value = []
    mock_load.mockResolvedValue({ id: poster_id, type: 'posters' })
    posting.value = false
    scroll_position.value = null
    storytelling.value = false
    only_mine.value = false
    window.localStorage.me = person_id
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    posting.value = false
    scroll_position.value = null
    storytelling.value = false
    only_mine.value = false
  })

  describe('Rendering', () => {
    it('renders the thoughts page shell', async () => {
      const wrapper = await settled(mount())
      expect(wrapper.find('section#thoughts[data-page]').exists()).toBe(true)
      expect(wrapper.find('h1').text()).toBe('Thoughts')
      expect(wrapper.findComponent({ name: 'AsFeedToggle' }).exists()).toBe(
        true
      )
      expect(wrapper.findComponent({ name: 'AsTextarea' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'AsDays' }).exists()).toBe(true)
      expect(wrapper.find('.poster-stub').exists()).toBe(true)
      wrapper.unmount()
    })

    it('removes the static thoughts shell after mount', async () => {
      const shell = document.createElement('section')
      shell.className = 'thoughts-shell'
      document.body.appendChild(shell)
      const wrapper = await settled(mount())
      expect(document.querySelector('.thoughts-shell')).toBeNull()
      wrapper.unmount()
    })

    it('shows processing queue items', async () => {
      mock_queue_items.value = [
        { id: '/queue/1', status: 'processing', width: 8, height: 8 }
      ]
      const wrapper = await settled(mount())
      expect(wrapper.find('section[data-processing-queue]').exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'AsSvgProcessing' }).exists()).toBe(
        true
      )
      wrapper.unmount()
    })

    it('shows a blog back-link when arriving from blog', async () => {
      window.history.replaceState(
        { back: 'https://blog.example/post' },
        '',
        '/?from=blog'
      )
      const wrapper = await settled(mount())
      const link = wrapper.find('header a[href="https://blog.example/post"]')
      expect(link.exists()).toBe(true)
      expect(link.text()).toBe('←')
      wrapper.unmount()
    })

    it('adds storytelling class when storytelling is on', async () => {
      storytelling.value = true
      const wrapper = await settled(mount())
      expect(
        wrapper.find('section#thoughts').attributes('data-storytelling')
      ).toBe('true')
      wrapper.unmount()
    })
  })

  describe('Feed loading', () => {
    it('loads phonebook and thoughts for relations on mount', async () => {
      const wrapper = await settled(mount())
      expect(mock_load_phonebook).toHaveBeenCalled()
      expect(mock_statements_for_person).toHaveBeenCalled()
      expect(mock_posters_for_person).toHaveBeenCalled()
      expect(mock_people.value.some(p => p.id === person_id)).toBe(true)
      expect(mock_set_working).toHaveBeenCalledWith(true)
      expect(mock_set_working).toHaveBeenCalledWith(false)
      expect(wrapper.vm.working).toBe(false)
      wrapper.unmount()
    })

    it('loads only the current user when only_mine is on', async () => {
      only_mine.value = true
      const wrapper = await settled(mount())
      expect(mock_statements_for_person).toHaveBeenCalledWith({ id: person_id })
      expect(mock_statements_for_person).not.toHaveBeenCalledWith({
        id: '/+14151234356/people/1'
      })
      expect(mock_people.value).toEqual([{ id: person_id, type: 'person' }])
      wrapper.unmount()
    })

    it('reloads with working state when only_mine toggles', async () => {
      const wrapper = await settled(mount())
      mock_set_working.mockClear()
      mock_statements_for_person.mockClear()
      only_mine.value = true
      await flushPromises()
      expect(mock_set_working).toHaveBeenCalledWith(true)
      expect(mock_set_working).toHaveBeenCalledWith(false)
      expect(mock_statements_for_person).toHaveBeenCalled()
      wrapper.unmount()
    })

    it('adds admin and fetches admin thoughts when signed out', async () => {
      vi.stubEnv('VITE_ADMIN_ID', '14151234356')
      mock_current_user_ref.value = null
      mock_phonebook.value = []
      window.localStorage.me = undefined

      const wrapper = await settled(mount())
      expect(mock_statements_for_person).toHaveBeenCalledWith({
        id: '/14151234356'
      })
      expect(mock_people.value.some(p => p.id === '/14151234356')).toBe(true)
      wrapper.unmount()
      vi.unstubAllEnvs()
    })
  })

  describe('Keymap and posting', () => {
    it('registers poster create and routes it to select_photo', async () => {
      const wrapper = await settled(mount())
      expect(mock_register).toHaveBeenCalledWith(
        'poster::Create_New',
        expect.any(Function)
      )
      const [, handler] = mock_register.mock.calls.find(
        ([command]) => command === 'poster::Create_New'
      )
      handler()
      expect(mock_select_photo).toHaveBeenCalled()
      wrapper.unmount()
    })

    it('toggles posting from the textarea keyboard event', async () => {
      const wrapper = await settled(mount())
      await wrapper
        .findComponent({ name: 'AsTextarea' })
        .vm.$emit('toggle-keyboard', true)
      expect(posting.value).toBe(true)
      await nextTick()
      expect(wrapper.findComponent({ name: 'AsFigure' }).exists()).toBe(false)
      wrapper.unmount()
    })

    it('restores scroll position when posting ends', async () => {
      const scroll_to = vi
        .spyOn(window, 'scrollTo')
        .mockImplementation(() => {})
      scroll_position.value = 420
      posting.value = true
      const wrapper = await settled(mount())
      posting.value = false
      await flushPromises()
      expect(scroll_to).toHaveBeenCalledWith(0, 420)
      expect(scroll_position.value).toBeNull()
      scroll_to.mockRestore()
      wrapper.unmount()
    })
  })

  describe('Poster removal', () => {
    it('opens the delete dialog when a poster asks to remove', async () => {
      const wrapper = await settled(mount())
      await wrapper
        .findComponent({ name: 'AsFigure' })
        .vm.$emit('remove', poster_id)
      await flushPromises()

      expect(mock_load).toHaveBeenCalledWith(poster_id)
      const dialog = wrapper.find('dialog[data-confirm]')
      expect(dialog.exists()).toBe(true)
      expect(dialog.element.open).toBe(true)
      expect(dialog.find('h1').text()).toBe('Delete Poster')
      wrapper.unmount()
    })

    it('does nothing when the poster cannot be loaded', async () => {
      mock_load.mockResolvedValue(null)
      const wrapper = await settled(mount())
      await wrapper
        .findComponent({ name: 'AsFigure' })
        .vm.$emit('remove', poster_id)
      await flushPromises()
      expect(wrapper.find('dialog[data-confirm]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('cancels deletion and closes the dialog', async () => {
      const wrapper = await settled(mount())
      await wrapper
        .findComponent({ name: 'AsFigure' })
        .vm.$emit('remove', poster_id)
      await flushPromises()
      await wrapper.find('button:not([data-delete])').trigger('click')
      expect(wrapper.find('dialog[data-confirm]').element.open).toBe(false)
      expect(mock_poster_delete).not.toHaveBeenCalled()
      wrapper.unmount()
    })

    it('closes when the dialog backdrop is clicked', async () => {
      const wrapper = await settled(mount())
      await wrapper
        .findComponent({ name: 'AsFigure' })
        .vm.$emit('remove', poster_id)
      await flushPromises()
      const dialog = wrapper.find('dialog[data-confirm]')
      await dialog.trigger('click')
      expect(dialog.element.open).toBe(false)
      wrapper.unmount()
    })

    it('deletes the poster after confirmation', async () => {
      const wrapper = await settled(mount())
      await wrapper
        .findComponent({ name: 'AsFigure' })
        .vm.$emit('remove', poster_id)
      await flushPromises()
      await wrapper.find('button[data-delete]').trigger('click')
      await flushPromises()

      expect(mock_poster_delete).toHaveBeenCalled()
      expect(mock_posters.value.find(p => p.id === poster_id)).toBeUndefined()
      wrapper.unmount()
    })

    it('purges a missing poster and reconciles the author directory', async () => {
      mock_posters.value = [
        { id: poster_id, type: 'posters' },
        { id: '/+14151234356/posters/1500', type: 'posters' },
        { id: '/+19999999999/posters/3000', type: 'posters' },
        { id: '/+14151234356/posters/500', type: 'posters' }
      ]
      mock_load_directory_from_network.mockResolvedValue({
        items: [1000, 2000]
      })

      const wrapper = await settled(mount())
      await wrapper
        .findComponent({ name: 'AsFigure' })
        .vm.$emit('missing', poster_id)
      await flushPromises()

      expect(del).toHaveBeenCalledWith(poster_id)
      expect(del).toHaveBeenCalledWith('/+14151234356/shadows/1000')
      expect(mock_clear_author_dirs).toHaveBeenCalledWith(person_id)
      expect(mock_load_directory_from_network).toHaveBeenCalledWith(
        '/+14151234356/posters'
      )
      const ids = mock_posters.value.map(p => p.id)
      expect(ids).not.toContain(poster_id)
      expect(ids).not.toContain('/+14151234356/posters/1500')
      expect(ids).toContain('/+19999999999/posters/3000')
      expect(ids).toContain('/+14151234356/posters/500')
      wrapper.unmount()
    })

    it('returns early when missing poster has an empty network directory', async () => {
      mock_load_directory_from_network.mockResolvedValueOnce({ items: [] })
      mock_posters.value = [
        { id: poster_id, type: 'posters' },
        { id: '/+14151234356/posters/1500', type: 'posters' }
      ]

      const wrapper = await settled(mount())
      await wrapper
        .findComponent({ name: 'AsFigure' })
        .vm.$emit('missing', poster_id)
      await flushPromises()

      expect(mock_clear_author_dirs).toHaveBeenCalledWith(person_id)
      expect(mock_posters.value.map(p => p.id)).toEqual([
        '/+14151234356/posters/1500'
      ])
      wrapper.unmount()
    })

    it('drops directory cache when a missing poster has no author', async () => {
      const wrapper = await settled(mount())
      await wrapper
        .findComponent({ name: 'AsFigure' })
        .vm.$emit('missing', 'not-an-id')
      await flushPromises()
      expect(del).toHaveBeenCalled()
      expect(mock_clear_author_dirs).not.toHaveBeenCalled()
      wrapper.unmount()
    })
  })

  describe('Feed refresh and storytelling scroll', () => {
    it('reloads phonebook and feed through the feed on_refresh hook', async () => {
      const wrapper = await settled(mount())
      expect(mock_feed_on_refresh.value).toEqual(expect.any(Function))
      mock_set_working.mockClear()
      mock_load_phonebook.mockClear()
      mock_statements_for_person.mockClear()

      await mock_feed_on_refresh.value()
      expect(mock_set_working).toHaveBeenCalledWith(true)
      expect(mock_load_phonebook).toHaveBeenCalled()
      expect(mock_statements_for_person).toHaveBeenCalled()
      expect(mock_set_working).toHaveBeenCalledWith(false)
      wrapper.unmount()
    })

    it('scrolls storytelling when a day section is focused', async () => {
      storytelling.value = true
      const wrapper = await settled(mount())

      const days_el = wrapper.find('.as-days-stub').element
      days_el.setAttribute('data-days', '')
      const article = document.createElement('article')
      const section = document.createElement('section')
      article.appendChild(section)
      days_el.appendChild(article)

      const scroll_to = vi.fn()
      article.scrollTo = scroll_to
      Object.defineProperty(article, 'scrollLeft', {
        configurable: true,
        value: 0,
        writable: true
      })
      article.getBoundingClientRect = () => ({
        left: 0,
        width: 300,
        top: 0,
        right: 300,
        bottom: 200,
        height: 200
      })
      section.getBoundingClientRect = () => ({
        left: 100,
        width: 100,
        top: 0,
        right: 200,
        bottom: 200,
        height: 200
      })

      section.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
      await flushPromises()
      expect(scroll_to).toHaveBeenCalled()
      wrapper.unmount()
    })

    it('scrolls into storytelling mode for the poster most in view', async () => {
      const wrapper = await settled(mount())
      const page = wrapper.find('section#thoughts').element
      const figure = page.querySelector('figure:has([itemtype="/posters"])')
      expect(figure).toBeTruthy()
      figure.getBoundingClientRect = () => ({
        top: 100,
        bottom: 300,
        left: 0,
        right: 100,
        height: 200,
        width: 100
      })
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: 800
      })

      const scroll_into_view = vi.fn()
      const focus = vi.fn()
      HTMLElement.prototype.scrollIntoView = scroll_into_view
      figure.focus = focus

      storytelling.value = true
      await flushPromises()
      await nextTick()
      await flushPromises()

      expect(
        document.querySelector(
          `section[data-page][data-storytelling] figure:has([itemtype="/posters"]) [itemid="${poster_id}"]`
        )
      ).toBeTruthy()
      wrapper.unmount()
      delete HTMLElement.prototype.scrollIntoView
    })

    it('returns from storytelling to feed scroll for the active poster', async () => {
      storytelling.value = true
      const wrapper = await settled(mount())
      const page = wrapper.find('section#thoughts').element
      page.setAttribute('data-storytelling', 'true')

      const days_el = wrapper.find('.as-days-stub').element
      days_el.setAttribute('data-days', '')
      const article = document.createElement('article')
      const section = document.createElement('section')
      const figure = page.querySelector('figure:has([itemtype="/posters"])')
      section.appendChild(figure.cloneNode(true))
      article.appendChild(section)
      days_el.appendChild(article)

      const feed_figure = page.querySelector(
        'figure:has([itemtype="/posters"])'
      )
      const scroll_into_view = vi.fn()
      const focus = vi.fn()
      feed_figure.scrollIntoView = scroll_into_view
      feed_figure.focus = focus
      feed_figure.getBoundingClientRect = () => ({
        top: 40,
        bottom: 240,
        left: 0,
        right: 120,
        height: 200,
        width: 120
      })

      storytelling.value = false
      await flushPromises()
      await nextTick()
      await flushPromises()

      expect(scroll_into_view).toHaveBeenCalledWith({
        block: 'center',
        behavior: 'auto'
      })
      expect(focus).toHaveBeenCalled()
      wrapper.unmount()
    })

    it('focuses the first poster on textarea tab-next', async () => {
      const wrapper = await settled(mount())
      const figure = wrapper.find('figure:has([itemtype="/posters"])').element
      const focus = vi.fn()
      figure.focus = focus
      const event = { preventDefault: vi.fn() }

      await wrapper
        .findComponent({ name: 'AsTextarea' })
        .vm.$emit('tab-next', event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(focus).toHaveBeenCalled()
      wrapper.unmount()
    })

    it('reloads phonebook when current_user becomes signed in', async () => {
      mock_current_user_ref.value = null
      const wrapper = await settled(mount())
      mock_load_phonebook.mockClear()
      mock_statements_for_person.mockClear()

      mock_current_user_ref.value = { uid: 'fresh-user' }
      await flushPromises()

      expect(mock_load_phonebook).toHaveBeenCalled()
      expect(mock_statements_for_person).toHaveBeenCalled()
      wrapper.unmount()
    })

    it('forwards poster show events to poster_shown', async () => {
      const wrapper = await settled(mount())
      const poster = { id: poster_id, type: 'posters' }
      await wrapper.findComponent({ name: 'AsFigure' }).vm.$emit('show', poster)
      expect(mock_poster_shown).toHaveBeenCalledWith(poster)
      wrapper.unmount()
    })

    it('hides posters while posting is active', async () => {
      const wrapper = await settled(mount())
      expect(wrapper.find('.poster-stub').exists()).toBe(true)
      posting.value = true
      await nextTick()
      expect(wrapper.find('.poster-stub').exists()).toBe(false)
      wrapper.unmount()
    })
  })
})
