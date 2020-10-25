import { shallowMount } from '@vue/test-utils'
import as_menu from '@/components/posters/as-menu'
import get_item from '@/modules/item'
import * as itemid from '@/helpers/itemid'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = get_item(poster_html)
const MockDate = require('mockdate')
MockDate.set('2020-01-01', new Date().getTimezoneOffset())
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+16282281824'
}
const events = [{
  id: `${person.id}/events/${new Date(2020, 1, 1).getTime()}`,
  url: poster.id
}]
describe('@/compontent/posters/as-menu.vue', () => {
  let wrapper
  beforeEach(() => {
    jest.spyOn(itemid, 'list').mockImplementationOnce(_ => Promise.resolve(events))
    wrapper = shallowMount(as_menu, { propsData: { itemid: poster.id } })
  })
  describe('Renders', () => {
    it('a poster menu', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
