import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import Account from '@/views/Account.vue'
import { sign_off } from '@/utils/serverless-auth'

const { mock_replace, mock_me, mock_current_user, mock_is_valid_name } =
  vi.hoisted(() => {
    const create_ref = value => ({ value, __v_isRef: true })
    return {
      mock_replace: vi.fn(),
      mock_me: create_ref(undefined),
      mock_current_user: create_ref(undefined),
      mock_is_valid_name: create_ref(true)
    }
  })

const mock_route = reactive({ query: {} })

vi.mock('vue-router', () => ({
  useRoute: () => mock_route,
  useRouter: () => ({ replace: mock_replace })
}))

vi.mock('@/utils/serverless', () => ({
  me: mock_me,
  current_user: mock_current_user
}))

vi.mock('@/utils/serverless-auth', () => ({
  sign_off: vi.fn()
}))

vi.mock('@/use/people', () => ({
  use_me: () => ({ is_valid_name: mock_is_valid_name }),
  is_person: vi.fn(() => true),
  name_error: vi.fn(() => null)
}))

const {
  mock_detect_brave,
  mock_sync_supported,
  mock_choose_folder,
  mock_sync_now,
  mock_history_pause,
  folder_state,
  reset_folder_state
} = vi.hoisted(() => {
  const create_ref = value => ({ value, __v_isRef: true })
  const state = {
    choose_folder: vi.fn(),
    sync_now: vi.fn(),
    refresh_name: vi.fn(),
    cancel_folder_sync: vi.fn(),
    folder_sync_name: create_ref(''),
    sync_folder_name: create_ref(''),
    folder_sync_status: create_ref('idle'),
    folder_sync_last_at: create_ref(null),
    folder_sync_error: create_ref(null),
    folder_sync_progress: create_ref({
      current: 0,
      total: 0,
      label: '',
      detail: ''
    })
  }
  return {
    mock_detect_brave: vi.fn(() => Promise.resolve(false)),
    mock_sync_supported: vi.fn(() => true),
    mock_choose_folder: state.choose_folder,
    mock_sync_now: state.sync_now,
    mock_history_pause: '…',
    folder_state: state,
    /** Reset the shared refs alone; replacing them would break the mounted view. */
    reset_folder_state: () => {
      state.choose_folder.mockClear()
      state.sync_now.mockClear()
      state.sync_folder_name.value = ''
      state.folder_sync_status.value = 'idle'
      state.folder_sync_last_at.value = null
      state.folder_sync_error.value = null
      state.folder_sync_progress.value = {
        current: 0,
        total: 0,
        label: '',
        detail: ''
      }
    }
  }
})

vi.mock('@/use/sync-folder', () => ({
  sync_folder_supported: () => mock_sync_supported(),
  detect_brave: mock_detect_brave,
  HISTORY_PAUSE_DETAIL: mock_history_pause,
  use: () => folder_state
}))

vi.mock('@/components/preferences-menu', () => ({
  default: {
    name: 'PreferencesMenu',
    template: '<menu class="preferences-menu-stub" />'
  }
}))

const default_stubs = {
  'logo-as-link': true,
  icon: true,
  'as-address': {
    name: 'AsAddress',
    template: '<address class="as-address-stub"><slot /></address>',
    props: ['person']
  },
  'as-form-name': {
    name: 'AsFormName',
    template: '<form class="name-as-form-stub" />'
  }
}

const mount = () =>
  shallowMount(Account, {
    global: { stubs: { ...default_stubs, Preference: false } }
  })

/** The folder controls live in the `preference` slot, so it cannot be stubbed. */
const mount_with_folder = () => ({ wrapper: mount(), folder: folder_state })

describe('Account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_route.query = {}
    mock_me.value = { id: '/+15550000000', name: 'Scott', type: 'person' }
    mock_current_user.value = { uid: 'test-user' }
    mock_is_valid_name.value = true
    mock_sync_supported.mockReturnValue(true)
    mock_detect_brave.mockResolvedValue(false)
    reset_folder_state()
    Object.defineProperty(window, 'showDirectoryPicker', {
      value: () => Promise.resolve(undefined),
      configurable: true,
      writable: true
    })
    Object.defineProperty(window, 'FileSystemFileHandle', {
      value: class FileSystemFileHandle {},
      configurable: true,
      writable: true
    })
  })

  it('renders the account section when signed in', () => {
    const wrapper = mount()
    expect(wrapper.find('section#account[data-page]').exists()).toBe(true)
  })

  it('offers neither account action while auth is unresolved', () => {
    mock_current_user.value = undefined
    const wrapper = mount()
    expect(wrapper.find('#sign-out').exists()).toBe(false)
    expect(wrapper.find('#sign-in').exists()).toBe(false)
  })

  it('shows the name field when signed in', () => {
    const wrapper = mount()
    expect(wrapper.find('.name-as-form-stub').exists()).toBe(true)
  })

  it('shows the name field when signed out too', () => {
    mock_current_user.value = null
    const wrapper = mount()
    expect(wrapper.find('.name-as-form-stub').exists()).toBe(true)
  })

  it('offers sign in rather than sign out when signed out', () => {
    mock_current_user.value = null
    const wrapper = mount()
    expect(wrapper.find('#sign-in').exists()).toBe(true)
    expect(wrapper.find('#sign-out').exists()).toBe(false)
    expect(mock_replace).not.toHaveBeenCalled()
  })

  it('sends Sign in to the sign-on page, never a dialog', () => {
    mock_current_user.value = null
    const wrapper = mount()
    expect(wrapper.find('#sign-in').attributes('to')).toBe('/sign-on')
    expect(wrapper.find('dialog#sign-on').exists()).toBe(false)
  })

  it('shows the sync folder preference when signed out', () => {
    mock_current_user.value = null
    const wrapper = mount()
    const sync_folder = wrapper
      .findAllComponents({ name: 'Preference' })
      .find(c => c.props('name') === 'sync_folder')
    expect(sync_folder).toBeTruthy()
  })

  it('shows the folder being written, with the thought name', () => {
    folder_state.folder_sync_status.value = 'syncing'
    folder_state.folder_sync_progress.value = {
      current: 2,
      total: 5,
      label: '2026-07-18 morning',
      detail: 'Writing thought'
    }
    const { wrapper } = mount_with_folder()
    expect(wrapper.find('[data-row] p').text()).toBe(
      '2 of 5: 2026-07-18 morning — Writing thought'
    )
  })

  it('counts the batch when no thought name is known yet', () => {
    folder_state.folder_sync_status.value = 'syncing'
    folder_state.folder_sync_progress.value = {
      current: 2,
      total: 5,
      label: '',
      detail: ''
    }
    const { wrapper } = mount_with_folder()
    expect(wrapper.find('[data-row] p').text()).toBe('Syncing 2 of 5')
  })

  it('shows the pause between history batches', () => {
    folder_state.folder_sync_status.value = 'syncing'
    folder_state.folder_sync_progress.value = {
      current: 0,
      total: 0,
      label: '',
      detail: mock_history_pause
    }
    const { wrapper } = mount_with_folder()
    expect(wrapper.find('[data-row] p').text()).toBe(mock_history_pause)
  })

  it('shows what the sync is doing before it counts anything', () => {
    folder_state.folder_sync_status.value = 'syncing'
    folder_state.folder_sync_progress.value = {
      current: 0,
      total: 0,
      label: '',
      detail: 'Gathering thoughts'
    }
    const { wrapper } = mount_with_folder()
    expect(wrapper.find('[data-row] p').text()).toBe('Gathering thoughts')
  })

  it('says only that it is syncing when there is nothing else to say', () => {
    folder_state.folder_sync_status.value = 'syncing'
    folder_state.folder_sync_progress.value = {
      current: 0,
      total: 0,
      label: '',
      detail: ''
    }
    const { wrapper } = mount_with_folder()
    expect(wrapper.find('[data-row] p').text()).toBe('Syncing…')
  })

  it('asks the user to re-authorize a folder that lost permission', () => {
    folder_state.folder_sync_status.value = 'needs_permission'
    const { wrapper } = mount_with_folder()
    expect(wrapper.find('[data-row] p').text()).toBe('Re-authorize folder')
  })

  it('names the failure when a sync fails', () => {
    folder_state.folder_sync_status.value = 'error'
    folder_state.folder_sync_error.value = 'disk full'
    const { wrapper } = mount_with_folder()
    expect(wrapper.find('[data-row] p').text()).toBe('Sync failed: disk full')
  })

  it('says only that a sync failed when no detail is known', () => {
    folder_state.folder_sync_status.value = 'error'
    folder_state.folder_sync_error.value = null
    const { wrapper } = mount_with_folder()
    expect(wrapper.find('[data-row] p').text()).toBe('Sync failed')
  })

  it('shows when the folder was last in step', () => {
    folder_state.folder_sync_last_at.value = '2026-07-18T09:30:00.000Z'
    const { wrapper } = mount_with_folder()
    expect(wrapper.find('[data-row] p').text()).toContain('Last synced')
  })

  it('ignores an unreadable last-sync time', () => {
    folder_state.folder_sync_last_at.value = 'not a date'
    const { wrapper } = mount_with_folder()
    expect(wrapper.find('[data-row] p').text()).toBe(
      'Mirror your thoughts to a folder'
    )
  })

  it('offers to choose a folder before one is set', () => {
    const { wrapper } = mount_with_folder()
    const buttons = wrapper.findAll('[data-row] button')
    expect(buttons[0].text()).toBe('Choose folder')
    expect(buttons[0].attributes('data-synced')).toBeUndefined()
    expect(buttons[1].attributes('disabled')).toBeDefined()
  })

  it('asks for the folder when none is chosen', async () => {
    const { wrapper, folder } = mount_with_folder()

    await wrapper.findAll('[data-row] button')[0].trigger('click')

    expect(folder.choose_folder).toHaveBeenCalled()
    expect(folder.sync_now).not.toHaveBeenCalled()
  })

  it('runs a sync for the chosen folder', async () => {
    folder_state.sync_folder_name.value = 'Exports'
    const { wrapper, folder } = mount_with_folder()

    await wrapper.findAll('[data-row] button')[1].trigger('click')

    expect(folder.sync_now).toHaveBeenCalled()
  })

  it('marks a chosen folder and enables sync', () => {
    folder_state.sync_folder_name.value = 'Exports'
    const { wrapper } = mount_with_folder()
    const buttons = wrapper.findAll('[data-row] button')
    expect(buttons[0].text()).toBe('Exports')
    expect(buttons[0].attributes('data-synced')).toBe('Exports')
    expect(buttons[1].attributes('disabled')).toBeUndefined()
  })

  it('tells a Brave user how to turn the folder API on', async () => {
    delete (/** @type {any} */ (window).showDirectoryPicker)
    delete (/** @type {any} */ (window).FileSystemFileHandle)
    mock_sync_supported.mockReturnValue(false)
    mock_detect_brave.mockResolvedValue(true)
    const wrapper = mount()
    await flushPromises()

    expect(wrapper.find('p[data-hint]').text()).toContain(
      'Brave disables this by default.'
    )

    const dialog = wrapper.find('dialog#brave-sync-folder-help')
    dialog.element.showModal = vi.fn()
    await wrapper.findAll('p[data-hint] button')[0].trigger('click')
    expect(dialog.element.showModal).toHaveBeenCalled()

    dialog.element.close = vi.fn()
    await dialog.find('menu button').trigger('click')
    expect(dialog.element.close).toHaveBeenCalled()
  })

  it('says plainly when the browser has no folder support at all', async () => {
    delete (/** @type {any} */ (window).showDirectoryPicker)
    delete (/** @type {any} */ (window).FileSystemFileHandle)
    mock_sync_supported.mockReturnValue(false)
    mock_detect_brave.mockResolvedValue(false)
    const wrapper = mount()
    await flushPromises()

    expect(wrapper.find('p[data-hint]').text()).toContain(
      'Not supported in this browser.'
    )
  })

  it('opens the sign-out dialog, and closes it without signing out', async () => {
    const wrapper = mount()
    const dialog = wrapper.find('dialog#confirm-sign-out')
    dialog.element.showModal = vi.fn()
    dialog.element.close = vi.fn()

    await wrapper.find('#sign-out').trigger('click')
    expect(dialog.element.showModal).toHaveBeenCalled()

    await dialog.findAll('menu button')[0].trigger('click')
    expect(dialog.element.close).toHaveBeenCalled()
    expect(sign_off).not.toHaveBeenCalled()
  })

  it('signs out after the dialog is confirmed', async () => {
    const wrapper = mount()
    const dialog = wrapper.find('dialog#confirm-sign-out')
    dialog.element.close = vi.fn()

    await dialog.find('menu button#confirm').trigger('click')

    expect(sign_off).toHaveBeenCalled()
    expect(dialog.element.close).toHaveBeenCalled()
  })

  it('nests the SVG preference inside sync folder', () => {
    const wrapper = shallowMount(Account, {
      global: {
        stubs: {
          ...default_stubs,
          Preference: false
        }
      }
    })
    const sync_folder = wrapper
      .findAllComponents({ name: 'Preference' })
      .find(c => c.props('name') === 'sync_folder')
    expect(sync_folder).toBeTruthy()
    const nested = sync_folder
      .findAllComponents({ name: 'Preference' })
      .find(c => c.props('name') === 'sync_svg')
    expect(nested).toBeTruthy()
  })
})
