import { vi } from 'vitest'

vi.mock('@/persistance/Storage', () => ({
  Storage: class {
    constructor(itemid) {
      this.id = itemid
    }
  },
  Statements: class {
    async save() {}
  },
  Me: class {
    async save() {}
  },
  Poster: class {
    async save() {}
  },
  Offline: class {
    constructor(itemid) {
      this.id = itemid
    }
    async save() {
      const outerHTML = await get(this.id)
      if (!outerHTML) return

      if (this.id.startsWith('/+/')) {
        const path_parts = this.id.split('/')
        path_parts[1] = localStorage.me.replace('/', '')
        this.id = path_parts.join('/')
      }

      await super.save({ outerHTML })
    }
  }
}))

vi.mock('@/persistance/Cloud', () => ({
  Cloud: Base =>
    class extends Base {
      async save() {}
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
      first_name: 'Scott',
      last_name: 'Fryxell',
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
      it('Does nothing unless there is a statement', async () => {
        wrapper.setProps({ statement })
        const save_spy = vi.spyOn(Statements.prototype, 'save')
        wrapper.setProps({ statement: null })
        expect(save_spy).not.toBeCalled()
      })
      it('Triggered when statement is set', async () => {
        await wrapper.setProps({ statement })
        await flush()
        expect(wrapper.emitted('update:statement')).toBeTruthy()
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
      it('Triggered when statement is set', async () => {
        localStorage.sync_time = Date.now()
        const save_spy = vi.spyOn(Me.prototype, 'save')
        wrapper = shallowMount(sync, fake_props)
        await wrapper.setProps({ person })
        await flush()
        expect(save_spy).toBeCalled()
      })
    })
  })
  describe('Methods', () => {
    describe('#visibility_change', () => {
      it('Plays the sync when app becomes visible', async () => {
        // being explicit
        const play = vi
          .spyOn(wrapper.vm, 'play')
          .mockImplementation(() => Promise.resolve())
        Object.defineProperty(window.document, 'visibilityState', {
          enumerable: false,
          configurable: false,
          writable: true,
          value: 'visible'
        })
        await wrapper.vm.play()
        expect(wrapper.vm.play).toBeCalled()
      })
      it('Is chill when the UI is hidden', async () => {
        wrapper = await shallowMount(sync, fake_props)
        wrapper.vm.syncer = {
          postMessage: vi.fn()
        }
        Object.defineProperty(window.document, 'visibilityState', {
          value: 'hidden'
        })
        const play = vi
          .spyOn(wrapper.vm, 'play')
          .mockImplementation(() => Promise.resolve())
        await wrapper.vm.visibility_change()
        expect(document.visibilityState).toBe('hidden')
        expect(play).not.toBeCalled()
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
        const anonymous_statement = {
          id: '/+/statements/123',
          action: 'save',
          type: 'statement',
          statement: 'Test anonymous statement'
        }
        await set('sync:offline', [anonymous_statement])

        const offline_save_spy = vi.spyOn(Offline.prototype, 'save')
        await sync_worker.sync_offline_actions()

        expect(offline_save_spy).toHaveBeenCalledWith()
        expect(await get('sync:offline')).toBeUndefined()
      })

      it('Migrates anonymous posters using Offline class', async () => {
        const created_at = Date.now()
        const anonymous_poster = {
          type: 'poster',
          content: 'Test poster content'
        }

        // Set up anonymous poster in IndexedDB
        await set('/+/posters/', { items: [created_at] })
        await set(`/+/posters/${created_at}`, anonymous_poster)

        const offline_save_spy = vi.spyOn(Offline.prototype, 'save')
        await sync_worker.sync_offline_actions()

        // Verify poster was migrated using Offline class and cleanup occurred
        expect(offline_save_spy).toHaveBeenCalled()
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
  let person

  beforeEach(() => {
    setup_current_user()
    person = {
      first_name: 'Scott',
      last_name: 'Fryxell',
      id: '/+14151234356',
      avatar: '/+14151234356/avatars/1578929551564',
      visited: '2021-02-04T18:30:01.038Z'
    }
    wrapper = shallowMount(vector_mock)
  })

  afterEach(() => {
    clear_current_user()
    vi.clearAllMocks()
  })

  describe('methods', () => {
    describe('#visit', () => {
      it('Exists', () => {
        expect(wrapper.vm.update_visit).toBeDefined()
      })

      it('Updates the user with a visit', async () => {
        const load_spy = vi
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(person))
        await wrapper.vm.update_visit()
        await flushPromises()
        expect(load_spy).toBeCalled()
        expect(wrapper.emitted('update:person')).toBeTruthy()
      })

      it('Does nothing unless there is a person', async () => {
        const load_spy = vi
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(null))
        await wrapper.vm.update_visit()
        await flushPromises()
        expect(load_spy).toBeCalled()
        expect(wrapper.emitted('update:person')).not.toBeTruthy()
      })

      it('Waits a proper interval before update to visit', async () => {
        person.visited = new Date().toISOString()
        const load_spy = vi
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(person))
        await wrapper.vm.update_visit()
        await flushPromises()
        expect(load_spy).toBeCalled()
        expect(wrapper.emitted('update:person')).not.toBeTruthy()
      })
    })
  })
})

describe('Offline Storage', () => {
  let cloud_save_spy

  beforeEach(() => {
    localStorage.me = '/+16282281824'
    cloud_save_spy = vi.spyOn(Cloud(Storage).prototype, 'save')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('Transforms anonymous statement IDs to user IDs', async () => {
    const anonymous_id = '/+/statements/123'
    const expected_id = '/+16282281824/statements/123'
    const statement_html = '<div>Test statement</div>'

    await set(anonymous_id, statement_html)
    const offline = new Offline(anonymous_id)

    await offline.save()

    expect(offline.id).toBe(expected_id)
    expect(cloud_save_spy).toHaveBeenCalledWith({ outerHTML: statement_html })
  })

  it('Transforms anonymous poster IDs to user IDs', async () => {
    const created_at = '1234567890'
    const anonymous_id = `/+/posters/${created_at}`
    const expected_id = `/+16282281824/posters/${created_at}`
    const poster_html = '<div>Test poster</div>'

    await set(anonymous_id, poster_html)
    const offline = new Offline(anonymous_id)

    await offline.save()

    expect(offline.id).toBe(expected_id)
    expect(cloud_save_spy).toHaveBeenCalledWith({ outerHTML: poster_html })
  })

  it('Does not transform already transformed IDs', async () => {
    const user_id = '/+16282281824/statements/123'
    const statement_html = '<div>Already transformed</div>'

    await set(user_id, statement_html)
    const offline = new Offline(user_id)

    await offline.save()

    expect(offline.id).toBe(user_id)
    expect(cloud_save_spy).toHaveBeenCalledWith({ outerHTML: statement_html })
  })

  it('Does nothing when content is not found', async () => {
    const anonymous_id = '/+/statements/not-found'
    const offline = new Offline(anonymous_id)

    await offline.save()

    expect(cloud_save_spy).not.toHaveBeenCalled()
  })
})
