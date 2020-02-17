
import { shallow, createLocalVue } from 'vue-test-utils'
import Item from '@/modules/item'
import VueRouter from 'vue-router'
import as_figure from '@/components/posters/as-figure'
const fs = require('fs')
const poster_mock = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
describe('@/compontent/posters/as-figure.vue', () => {
  let person, wrapper
  beforeEach(() => {
    person = {
      created_at: '2018-07-15T18:11:31.018Z',
      first_name: 'Scott',
      last_name: 'Fryxell',
      id: '/+16282281823'
    }
    wrapper = shallow(as_figure, {
      propsData: {
        author: person,
        poster: Item.get_items(poster_mock)[0]
      }
    })
  })
  it('Render a poster', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
})
