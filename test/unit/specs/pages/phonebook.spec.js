import Vue from 'vue'
import {mount, shallow} from 'vue-test-utils'
import phonebook from '@/pages/phonebook'
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
describe('@/pages/phonebook', () => {
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
  
})
