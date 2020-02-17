
import { shallow, createLocalVue } from 'vue-test-utils'
import Item from '@/modules/item'
import VueRouter from 'vue-router'
import as_figure from '@/components/posters/as-figure'
const fs = require('fs')
const poster_file = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')

const poster = Item.get_items(poster_file)[0]
const author = {
  created_at: '2018-07-15T18:11:31.018Z',
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+16282281823'
}
describe('@/compontent/posters/as-figure.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(as_figure, {
      propsData: { author, poster }
    })
  })
  it ('Render a poster', () => {
    expect(wrapper.element).toMatchSnapshot()
  })

  it ('Render a new poster', () => {
    wrapper.setProps({
      is_new: true
    })
    expect(wrapper.element).toMatchSnapshot()
  })

})
