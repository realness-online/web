import { shallowMount, flushPromises } from '@vue/test-utils'
import download_vector from '@/components/download-vector'
import * as itemid from '@/use/itemid'
import get_item, { hydrate } from '@/use/item'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = get_item(poster_html)
const person = {
  id: '/+14151234356',
  first_name: 'Scott',
  last_name: 'Fryxell',
  mobile: '4151234356',
  avatar: 'avatars/5553338945763'
}
describe('@/components/download-vector', () => {
  describe('Renders', () => {
    it('Link to download svg', () => {
      jest
        .spyOn(document, 'getElementById')
        .mockImplementation(() => hydrate(poster_html))

      jest
        .spyOn(itemid, 'load')
        .mockImplementation(() => Promise.resolve(person))

      const wrapper = shallowMount(download_vector, {
        props: {
          itemid: poster.id
        }
      })

      expect(wrapper.element).toMatchSnapshot()
    })
    it('Handles downloads from anonymous users', async () => {
      jest
        .spyOn(document, 'getElementById')
        .mockImplementation(() => hydrate(poster_html))

      jest.spyOn(itemid, 'load').mockImplementation(() => Promise.resolve(null))

      const wrapper = shallowMount(download_vector, {
        props: {
          itemid: poster.id
        }
      })
      await flushPromises()
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
