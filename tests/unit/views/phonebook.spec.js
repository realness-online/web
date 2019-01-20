import { shallow } from 'vue-test-utils'
import phonebook from '@/views/phonebook'
import PhoneBook from '@/modules/PhoneBook'
import Item from '@/modules/Item'
import Storage from '@/modules/Storage'
const phonebook_as_text = `
  <div id="phonebook">
    <figure itemscope itemtype="/person" itemid='6282281824'>
      <svg><use itemprop="profile_vector" xlink:href="/static/icons.svg#silhouette"></use></svg>
      <figcaption>
        <p><span itemprop="first_name">Scott</span><span itemprop="last_name">Fryxell</span></p>
        <a itemprop="mobile" data-value="6282281824">+1 (628) 228-1824</a>
      </figcaption>
    </figure>
    <figure itemscope itemtype="/person" itemid='+12403800385‬'>
      <svg><use itemprop="profile_vector" xlink:href="/static/icons.svg#silhouette"></use></svg>
      <figcaption>
        <p><span itemprop="first_name">Katie</span><span itemprop="last_name">Caffey</span></p>
        <a itemprop="mobile" data-value="2403800385‬">+1 (240) 380-0385‬</a>
      </figcaption>
    </figure>
  <div>`
const people = Item.get_items(Storage.hydrate(phonebook_as_text))
const save_spy = jest.fn(() => Promise.resolve('save_spy'))
jest.spyOn(PhoneBook.prototype, 'sync_list').mockImplementation(() => {
  return Promise.resolve(people)
})
jest.spyOn(PhoneBook.prototype, 'save').mockImplementation(save_spy)
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  mobile: '4151234356'
}
describe('@/views/phonebook', () => {
  it('render an empty phonebook', () => {
    let wrapper = shallow(phonebook)
    expect(wrapper.element).toMatchSnapshot()
  })
  it('saves the phone book when save-phonebook is set on localStorage', async () => {
    let wrapper = shallow(phonebook)
    wrapper.vm.phonebook.push(person)
    expect(wrapper.vm.phonebook.length).toBe(1)
    expect(save_spy).not.toBeCalled()
    localStorage.setItem('save-phonebook', 'true')
    await wrapper.vm.phonebook.push(person)
    expect(wrapper.vm.phonebook.length).toBe(2)
    wrapper.vm.$nextTick(() => {
      expect(save_spy).toBeCalled()
    })
    save_spy.mockClear()
  })
})
