import { shallow } from 'vue-test-utils'
import flushPromises from 'flush-promises'
import download_vector from '@/components/download-vector'
import itemid from '@/helpers/itemid'
import Item from '@/modules/item'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = Item.get_items(poster_html)[0]
const person = {
  id: '/+14151234356',
  first_name: 'Scott',
  last_name: 'Fryxell',
  mobile: '4151234356',
  avatar: 'avatars/5553338945763'
}
describe ('@/components/download-vector', () => {
  it ('Renders link to download svg',  async () => {
    jest.spyOn(itemid, 'as_object').mockImplementationOnce(_ => Promise.resolve(poster))
    jest.spyOn(itemid, 'as_object').mockImplementationOnce(_ => Promise.resolve(person))
    const wrapper = shallow(download_vector, {
      propsData: {
        itemid: poster.id
      }
    })
    await flushPromises()
    expect(wrapper.element).toMatchSnapshot()
  })
})
