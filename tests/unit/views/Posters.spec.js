import { shallow } from 'vue-test-utils'
import Posters from '@/views/Posters'
import Item from '@/modules/item'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = Item.get_items(poster_html)[0]

const author = {
  created_at: '2018-07-15T18:11:31.018Z',
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+16282281823'
}
const events = [{
  id: new Date(2020, 1, 1).getTime(),
  poster: poster.id
}]

describe('@/views/Posters.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(Posters)
    wrapper.vm.posters = [poster]
    wrapper.vm.events = events
  })
  describe('Rendering', () => {
    it('Renders ui for posters', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('methods', () => {
    describe('get_id', () => {
      it('gets the poster id from the directory listing on hte network', () => {
        wrapper.vm.get_id({ name: `${poster.id}.html` })
      })
    })
    describe('newer_first', () => {
      it('Sorts a list by newer first', () => {
        const earlier = { created_at: 1582074363603 }
        const later = { created_at: 1582074400500 }
        expect(wrapper.vm.newer_first(earlier, later)).toBeTruthy()
        expect(wrapper.vm.newer_first(later, earlier)).toBeTruthy()
      })
    })
    describe('vectorize_image', () => {
      it('executes the method', () => {
        wrapper.vm.vectorize_image()
      })
    })
    describe('sync_posters_with_network', () => {
      it('executes the method', () => {
        wrapper.vm.sync_posters_with_network({})
      })
    })
    describe('brand_new_poster', () => {
      it('gets the poster from the worker', () => {
        const event = {
          data: poster
        }
        wrapper.vm.working = true
        wrapper.vm.brand_new_poster(event)
        expect(wrapper.vm.working).toBe(false)
        expect(wrapper.vm.new_poster.id).toBe(poster.id)
      })
    })
    describe('remove_new_poster', () => {
      it('executes the method', () => {
        wrapper.vm.remove_new_poster()
      })
    })
    describe('add_poster', () => {
      it('executes the method', () => {
        wrapper.vm.add_poster()
      })
    })
    describe('remove_poster', () => {
      it('executes the method', () => {
        wrapper.vm.remove_poster()
      })
    })
    describe('add_event', () => {
      it('executes the method', () => {
        wrapper.vm.add_event()
      })
    })
    describe('remove_event', () => {
      it('executes the method', () => {
        wrapper.vm.remove_event()
      })
    })
  })
})
