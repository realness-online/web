import { shallowMount } from '@vue/test-utils'
import flushPromises from 'flush-promises'
import download_vector from '@/components/download-vector'
import * as itemid from '@/helpers/itemid'
import get_item from '@/modules/item'
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
    it('Link to download svg', async () => {
      jest.spyOn(itemid, 'load').mockImplementation(itemid => {
        if (itemid === '/+16282281824/posters/559666932867') return Promise.resolve(poster)
        else return Promise.resolve(person)
      })
      const wrapper = shallowMount(download_vector, {
        props: {
          itemid: poster.id
        }
      })
      await flushPromises()
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Handles downloads from anonymous users', async () => {
      jest.spyOn(itemid, 'load').mockImplementation(itemid => {
        if (itemid === '/+16282281824/posters/559666932867') return Promise.resolve(poster)
        else return Promise.resolve(null)
      })
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
