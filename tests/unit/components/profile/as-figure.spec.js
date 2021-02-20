import { shallowMount, createLocalVue } from '@vue/test-utils'
import VueRouter from 'vue-router'
import { get } from 'idb-keyval'
import as_figure from '@/components/profile/as-figure'
const avatar_mock = require('fs').readFileSync('./tests/unit/html/avatar.html', 'utf8')
describe('@/compontent/profile/as-figure.vue', () => {
  let person, wrapper
  beforeEach(() => {
    get.mockImplementation(_ => Promise.resolve({}))
    localStorage.me = '/+16282281824'
    person = {
      first_name: 'Scott',
      last_name: 'Fryxell',
      id: '/+16282281823'
    }
    wrapper = shallowMount(as_figure, {
      propsData: {
        person: person,
        relations: [
          { id: '/+16282281823' },
          { id: '/+16282281824' },
          { id: '/+14155551243' },
          { id: '/+14154314233' }
        ]
      }
    })
  })
  describe('Renders', () => {
    it('Render a person\'s profile info', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Render the users avatar', () => {
      let avatar = wrapper.find('[itemprop=avatar]')
      expect(avatar.empty).toBeFalsy()
      const new_person = {
        first_name: 'Scott',
        last_name: 'Fryxell',
        id: '/+16282281823',
        avatar: avatar_mock
      }
      wrapper.setProps({ person: new_person })
      avatar = wrapper.find('[itemprop=avatar]')
      expect(avatar.empty).not.toBeTruthy()
    })
  })
  describe('Methods:', () => {
    describe('#avatar_click', () => {
      let router
      beforeEach(() => {
        const localVue = createLocalVue()
        localVue.use(VueRouter)
        router = new VueRouter()
        wrapper = shallowMount(as_figure, {
          localVue,
          router,
          propsData: { person }
        })
      })
      it('Go to the mobile number when clicked', () => {
        wrapper.vm.avatar_click()
        expect(wrapper.vm.$route.path).toBe('/+16282281823')
      })
      it('When is_me is true should go to the account page', () => {
        localStorage.me = person.id
        wrapper.vm.avatar_click()
        expect(wrapper.vm.$route.path).toBe('/account')
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
