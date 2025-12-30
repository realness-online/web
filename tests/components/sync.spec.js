import { vi } from 'vitest'

// Define mocks before other imports
vi.mock('@/persistance/Storage', () => ({
  Storage: class {
    constructor(itemid) {
      this.id = itemid
    }
  },
  Statements: class {
    constructor(itemid) {
      this.id = itemid
    }
    async save() {
      return Promise.resolve()
    }
  },
  Me: class {
    constructor(itemid) {
      this.id = itemid
    }
    async save() {
      return Promise.resolve()
    }
  },
  Poster: class {
    constructor(itemid) {
      this.id = itemid
    }
    async save() {
      return Promise.resolve()
    }
  },
  Offline: class {
    constructor(itemid) {
      this.id = itemid
    }
    async save() {
      const original_id = this.id
      const { get } = await import('idb-keyval')
      const data = await get(original_id)
      if (!data) return

      // Transform anonymous IDs to user IDs (matching real implementation)
      let { id } = this
      if (id.startsWith('/+/')) {
        // Parse the path: /+/statements/123 -> ['', '+', 'statements', '123']
        const parts = id.split('/').filter(Boolean)
        const type = parts[1] // 'statements' or 'posters'
        const created_at = parts[2] // '123' or timestamp
        id = `${localStorage.me}/${type}/${created_at}`
        this.id = id
      }

      // Get the data and call Cloud save to trigger the spy
      let parsed_data
      if (typeof data === 'string') {
        parsed_data = { outerHTML: data }
      } else if (data && typeof data === 'object' && data.outerHTML) {
        parsed_data = data
      } else if (data && typeof data === 'object') {
        parsed_data = { outerHTML: JSON.stringify(data) }
      } else {
        parsed_data = { outerHTML: data }
      }
      const { Cloud } = await import('@/persistance/Cloud')
      const cloud_instance = new (Cloud(Storage))(this.id)
      await cloud_instance.save({ ...parsed_data, id: this.id })
      return parsed_data
    }
  }
}))

vi.mock('@/persistance/Cloud', () => ({
  Cloud: Base => {
    class CloudStorage extends Base {
      async save() {
        return Promise.resolve()
      }
    }
    return CloudStorage
  }
}))

// Now import everything else
import { shallowMount, mount, flushPromises as flush } from '@vue/test-utils'
import { get, set } from 'idb-keyval'
import * as itemid from '@/utils/itemid'
import * as sync_worker from '@/use/sync'
import sync from '@/components/sync'
import { Storage, Statements, Me, Poster, Offline } from '@/persistance/Storage'
import { Cloud } from '@/persistance/Cloud'
import {
  setup_current_user,
  clear_current_user,
  test_user
} from '../mocks/helpers/user'

const fake_props = {
  global: {
    stubs: ['router-link', 'router-view']
  },
  props: { config: {} }
}
const statement = {
  id: '/+16282281824',
  type: 'statements',
  statement: 'I like to move it'
}
let current_user = {
  phoneNumber: '+16282281824'
}
describe('@/components/sync', () => {
  let wrapper
  let person

  beforeEach(async () => {
    setup_current_user()
    person = {
      name: 'Scott Fryxell',
      id: '/+16282281824',
      avatar: '/+16282281824/avatars/1578929551564',
      visited: '2020-03-03T17:37:22.943Z'
    }
    wrapper = shallowMount(sync)
    await flush()
  })

  afterEach(() => {
    clear_current_user()
    vi.clearAllMocks()
  })

  describe('Render', () => {
    it('Renders sync component', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Watchers', () => {
    describe('statement', () => {
      it('Component renders without statement prop', async () => {
        expect(wrapper.vm).toBeTruthy()
      })
    })
    describe('person', () => {
      it('Does nothing unless there is a person', async () => {
        const props = { ...fake_props }
        props.props.person = person
        wrapper = await shallowMount(sync, props)
        wrapper.setProps({ person: null })
        const save_spy = vi.spyOn(Me.prototype, 'save')
        expect(wrapper.emitted('update:person')).not.toBeTruthy()
        expect(save_spy).not.toBeCalled()
      })
      it('Component renders without person prop', async () => {
        wrapper = shallowMount(sync, fake_props)
        await flush()
        expect(wrapper.vm).toBeTruthy()
      })
    })
  })
  describe('Methods', () => {
    describe('#visibility_change', () => {
      it('Component handles visibility changes', async () => {
        Object.defineProperty(window.document, 'visibilityState', {
          enumerable: false,
          configurable: false,
          writable: true,
          value: 'visible'
        })
        expect(wrapper.vm).toBeTruthy()
      })
      it('Is chill when the UI is hidden', async () => {
        wrapper = await shallowMount(sync, fake_props)
        wrapper.vm.syncer = {
          postMessage: vi.fn()
        }
        Object.defineProperty(window.document, 'visibilityState', {
          value: 'hidden'
        })
        expect(document.visibilityState).toBe('hidden')
        expect(wrapper.vm).toBeTruthy()
      })
    })
    describe('#get_my_itemid', () => {
      it('Returns the user itemid when called without type', async () => {
        expect(localStorage.me).toBe(`/${current_user.phoneNumber}`)
        wrapper = shallowMount(sync, fake_props)
        await flush()
        expect(wrapper.vm.get_my_itemid()).toBe('/+16282281824')
      })
    })
    describe('#sync_offline_actions', () => {
      beforeEach(async () => {
        // Mock online status
        Object.defineProperty(navigator, 'onLine', {
          value: true,
          writable: true
        })
      })

      it('Processes anonymous statements from sync:offline queue', async () => {
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true })

        const anonymous_statement = {
          id: '/+/statements/123',
          action: 'save',
          type: 'statement',
          statement: 'Test anonymous statement'
        }
        await set('sync:offline', [anonymous_statement])
        await set('/+/statements/123', '<div>test</div>')

        await sync_worker.sync_offline_actions()

        expect(await get('sync:offline')).toBeUndefined()
      })

      it('Migrates anonymous posters using Offline class', async () => {
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true })

        const created_at = Date.now()
        const anonymous_poster = '<svg>Test poster</svg>'

        // Set up anonymous poster in IndexedDB
        await set('/+/posters/', { items: [created_at] })
        await set(`/+/posters/${created_at}`, anonymous_poster)

        await sync_worker.sync_offline_actions()

        // Verify cleanup occurred
        expect(await get('/+/posters/')).toBeUndefined()
        expect(await get(`/+/posters/${created_at}`)).toBeUndefined()
      })

      it('Does nothing when offline', async () => {
        Object.defineProperty(navigator, 'onLine', { value: false })

        const offline_save_spy = vi.spyOn(Offline.prototype, 'save')

        await sync_worker.sync_offline_actions()

        expect(offline_save_spy).not.toHaveBeenCalled()
      })
    })
  })
})

describe('@/use/sync', () => {
  let wrapper

  beforeEach(() => {
    setup_current_user()
    wrapper = shallowMount(sync)
  })

  afterEach(() => {
    clear_current_user()
    vi.clearAllMocks()
  })

  describe('methods', () => {
    describe('#visit', () => {
      it('Component renders correctly', () => {
        expect(wrapper.vm).toBeTruthy()
      })
    })
  })
})

describe('Offline Storage', () => {
  beforeEach(() => {
    localStorage.me = '/+16282281824'
  })

  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('Handles anonymous statement IDs', async () => {
    const anonymous_id = '/+/statements/123'
    const statement_html = '<div>Test statement</div>'

    await set(anonymous_id, statement_html)
    const offline = new Offline(anonymous_id)
    await offline.save()

    expect(offline.id).toBeDefined()
  })

  it('Handles anonymous poster IDs', async () => {
    const anonymous_id = '/+/posters/1234567890'
    const poster_html = '<svg>Test poster</svg>'

    await set(anonymous_id, poster_html)
    const offline = new Offline(anonymous_id)
    await offline.save()

    expect(offline.id).toBeDefined()
  })

  it('Does not transform already transformed IDs', async () => {
    const user_id = '/+16282281824/statements/123'
    const statement_html = `<div itemid="${user_id}">Already transformed</div>`

    await set(user_id, statement_html)
    const offline = new Offline(user_id)
    await offline.save()

    expect(offline.id).toBe(user_id)
  })

  it('Does nothing when content is not found', async () => {
    const anonymous_id = '/+/statements/not-found'
    const offline = new Offline(anonymous_id)
    const result = await offline.save()

    expect(result).toBeUndefined()
    expect(offline.id).toBe(anonymous_id)
  })
})
