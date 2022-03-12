import { shallowMount } from '@vue/test-utils'
import App from '@/App'
describe('@/App.vue', () => {
  let wrapper
  const node_env = import.meta.env
  beforeEach(async () => {
    process.env = { ...node_env }
    wrapper = await shallowMount(App)
  })
  afterEach(() => {
    wrapper.unmount()
    vi.resetModules()
  })
  afterAll(() => {
    process.env = node_env
  })
  describe('Renders', () => {
    it('Layout of the application', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Calls offline is app is initialized offline', async () => {
      vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValueOnce(false)
      wrapper = await shallowMount(App)
    })
  })
  describe('Methods', () => {
    describe('#onLine', () => {
      it('Turns the editable content back on', () => {
        const elements = [{ setAttribute: vi.fn() }]
        wrapper.vm.status = 'offline'
        vi.spyOn(document, 'querySelectorAll').mockReturnValueOnce(elements)
        wrapper.vm.online()
        expect(wrapper.vm.status.value).toBe(null)
        expect(elements[0].setAttribute).toBeCalled()
      })
    })
    describe('#offLine', () => {
      it('Turns the editable content back on', () => {
        const elements = [{ setAttribute: vi.fn() }]
        wrapper.vm.status = 'offline'
        vi.spyOn(document, 'querySelectorAll').mockReturnValueOnce(elements)
        wrapper.vm.offline()
        expect(wrapper.vm.status.value).toBe('offline')
        expect(elements[0].setAttribute).toBeCalled()
      })
    })
    describe('#sync_active', () => {
      it('Sets Status to active whebn syncing', () => {
        wrapper.vm.status.value = 'offline'
        wrapper.vm.sync_active(true)
        expect(wrapper.vm.status.value).toBe('working')
      })
      it('Sets Status to null when not syncing', () => {
        wrapper.vm.status.value = 'offline'
        wrapper.vm.sync_active(false)
        expect(wrapper.vm.status.value).toBe(null)
      })
    })
  })
})
