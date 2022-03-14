import { shallowMount } from '@vue/test-utils'
import App from '@/App'
describe('@/App.vue', () => {
  let wrapper
  const node_env = import.meta.env
  beforeEach(async () => {
    process.env = { ...node_env }
    wrapper = await shallowMount(App, {
      global: {
        stubs: ["router-link", "router-view"]
      }
    })
  })
  afterEach(() => {
    wrapper.unmount()
    // vi.resetModules()
  })
  afterAll(() => {
    process.env = node_env
  })
  describe('Renders', () => {
    it('Layout of the application', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Methods', () => {
    describe('#onLine', () => {
      it('Turns the editable content back on', () => {
        const elements = [{ setAttribute: vi.fn() }]

        wrapper.vm.status = 'offline'
        vi.spyOn(document, 'querySelectorAll').mockReturnValueOnce(elements)
        wrapper.vm.online()

        expect(wrapper.vm.status).toBe(null)
        expect(elements[0].setAttribute).toBeCalled()
      })
    })
    describe('#offLine', () => {
      it('Turns the editable content back on', () => {
        const elements = [{ setAttribute: vi.fn() }]
        wrapper.vm.status = 'offline'
        vi.spyOn(document, 'querySelectorAll').mockReturnValueOnce(elements)
        wrapper.vm.offline()
        expect(wrapper.vm.status).toBe('offline')
        expect(elements[0].setAttribute).toBeCalled()
      })
    })
    describe('#sync_active', () => {
      it('Sets status to active when syncing', () => {
        wrapper.vm.status = 'offline'
        wrapper.vm.sync_active(true)
        expect(wrapper.vm.status).toBe('working')
      })
      it('Sets status to null when not syncing', () => {
        wrapper.vm.status = 'offline'
        wrapper.vm.sync_active(false)
        expect(wrapper.vm.status).toBe(null)
      })
    })
  })
})
