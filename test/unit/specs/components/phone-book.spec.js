import Vue from 'vue'
import {mount, shallow} from 'vue-test-utils'
import phonebook from '@/components/phone-book'
import Item from '@/modules/Item'
import Storage from '@/modules/Storage'

const phonebook_as_text = `
  <div id="phonebook">
    <figure itemscope itemtype="/person" itemid='+16282281824'>
      <svg><use itemprop="profile_vector" xlink:href="/static/icons.svg#silhouette"></use></svg>
      <figcaption>
        <p><span itemprop="first_name">Scott</span><span itemprop="last_name">Fryxell</span></p>
        <a itemprop="mobile" data-value="+16282281824">+1 (628) 228-1824</a>
      </figcaption>
    </figure>
    <figure itemscope itemtype="/person" itemid='+12403800385‬'>
      <svg><use itemprop="profile_vector" xlink:href="/static/icons.svg#silhouette"></use></svg>
      <figcaption>
        <p><span itemprop="first_name">Katie</span><span itemprop="last_name">Caffey</span></p>
        <a itemprop="mobile" data-value="+12403800385‬">+1 (240) 380-0385‬</a>
      </figcaption>
    </figure>
  <div>`
const save_spy = jest.fn(() => Promise.resolve('save_spy'))
const update_spy = jest.fn((person) => Promise.resolve(people))
const people = Item.get_items(Storage.hydrate(phonebook_as_text))
describe('@/components/phone-book', () => {
  let wrapper
  afterEach(() => {
    save_spy.mockClear()
    update_spy.mockClear()
  })
  it('render an empty phonebook', () => {
    wrapper = shallow(phonebook)
    expect(wrapper.element).toMatchSnapshot()
  })
  it('render a phonebook with people', () => {
    wrapper = mount(phonebook)
    wrapper.setData({phonebook: people})
    expect(wrapper.element).toMatchSnapshot()
  })
  describe('events', () => {
    let storage_info = {
      phonebook_storage: {
        update: update_spy,
        save: save_spy
      }
    }
    beforeEach(() => {
      Vue.prototype.$bus = new Vue({})
      wrapper = shallow(phonebook)
      wrapper.setData(storage_info)
    })
    it('updates the phonebook when a user signs in', () => {
      wrapper.vm.$bus.$emit('signed-in', people[0])
      expect(update_spy).toBeCalled()
    })
    it('updates the phonebook when a user is saved', () => {
      wrapper.vm.$bus.$emit('person-saved', people[0])
      expect(update_spy).toBeCalled()
    })
  })
})
