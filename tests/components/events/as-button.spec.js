import { shallowMount } from '@vue/test-utils'
import as_button from '@/components/events/as-button'
import get_item from '@/use/item'
import * as itemid from '@/use/itemid'
import fs from 'fs'
const poster_html = fs.readFileSync('./__mocks__/html/poster.html', 'utf8')
const poster = get_item(poster_html)
const MockDate = require('mockdate')
MockDate.set('2020-01-01', new Date().getTimezoneOffset())
const events = [
  {
    id: `${new Date(2020, 1, 1).getTime()}`,
    url: poster.id
  }
]
describe('@/compontent/events/as-button.vue', () => {
  let wrapper
  beforeEach(() => {
    vi.spyOn(itemid, 'list').mockImplementationOnce(() =>
      Promise.resolve(events)
    )
    wrapper = shallowMount(as_button, { props: { itemid: poster.id } })
  })
  describe('Renders', () => {
    it("A button to manage a poster's events", () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
