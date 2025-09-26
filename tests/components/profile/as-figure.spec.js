import { shallowMount } from '@vue/test-utils'
import { get } from 'idb-keyval'
import as_figure from '@/components/profile/as-figure'
describe('@/component/profile/as-figure.vue', () => {
  let person, wrapper
  beforeEach(() => {
    get.mockImplementation(() => Promise.resolve({}))
    localStorage.me = '/+16282281824'
    person = {
      first_name: 'Scott',
      last_name: 'Fryxell',
      id: '/+16282281823'
    }
    wrapper = shallowMount(as_figure, {
      props: {
        person,
        relations: [
          { id: '/+16282281823' },
          { id: '/+14155551243' },
          { id: '/+14154314233' }
        ]
      }
    })
  })
  describe('Renders', () => {
    it("Render a person's profile info", () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Methods:', () => {
    describe('#avatar_click', () => {
      it('Go to the mobile number when clicked', () => {
        const $router = { push: vi.fn() }
        wrapper = shallowMount(as_figure, {
          global: {
            mocks: { $router }
          },
          props: { person }
        })
        wrapper.vm.avatar_click()
        expect($router.push).toHaveBeenCalledTimes(1)
        expect($router.push).toHaveBeenCalledWith({ path: '/+16282281823' })
        // expect(wrapper.vm.$route.path).toBe('/+16282281823')
      })
      it('When is_me is true should go to the account page', () => {
        const $router = { push: vi.fn() }
        localStorage.me = '/+16282281823'
        wrapper = shallowMount(as_figure, {
          global: {
            mocks: { $router }
          },
          props: { person }
        })
        wrapper.vm.avatar_click()
        expect($router.push).toHaveBeenCalledTimes(1)
        expect($router.push).toHaveBeenCalledWith({ path: '/account' })
      })
    })
    describe('#add_relationship', () => {
      it('Adds a person to my list of relationships', async () => {
        await wrapper.vm.add_relationship()
        expect(wrapper.emitted('update:relations')).toBeTruthy()
      })
    })
    describe('#remove_relationship', () => {
      it('Removes a person from my list of relationships', async () => {
        await wrapper.vm.remove_relationship(person)
        expect(wrapper.emitted('update:relations')).toBeTruthy()
      })
      it('Does nothing if relationsship is not there', async () => {
        const not_relation = { ...person }
        not_relation.id = '/+13042901453'
        await wrapper.vm.remove_relationship(not_relation)
        expect(wrapper.emitted('update:relations')).not.toBeTruthy()
      })
      it('Removes relations from local storage entirely with last realtionship', async () => {
        wrapper.setProps({ relations: [{ id: '/+16282281823' }] })
        await wrapper.vm.remove_relationship(person)
        expect(wrapper.emitted('update:relations')).toBeTruthy()
        expect(localStorage.relations).toBe(undefined)
      })
    })
  })
})
