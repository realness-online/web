import { shallow } from 'vue-test-utils'
import Storage from '@/modules/Storage'
import Feed from '@/views/Feed'
const posts_as_text = `
  <div itemprop="posts" itemref="profile">
   <article itemscope itemtype="/post"><blockquote itemprop="articleBody">This is a word</blockquote> <time itemprop="created_at" datetime="2018-04-13T20:02:50.533Z"></time></article>
   <article itemscope itemtype="/post"><blockquote itemprop="articleBody">These are some words.</blockquote> <time itemprop="created_at" datetime="2018-07-05T23:25:58.145Z"></time></article>
   <article itemscope itemtype="/post"><blockquote itemprop="articleBody">I am writing some words right now testing some magical magic out</blockquote> <time itemprop="created_at" datetime="2018-07-07T20:13:42.760Z">2 days ago</time></article>
   <article itemscope itemtype="/post"><blockquote itemprop="articleBody">zipper faced monkey</blockquote> <time itemprop="created_at" datetime="2018-07-07T23:11:51.460Z"></time></article>
   <article itemscope itemtype="/post"><blockquote itemprop="articleBody">from the bottom of the zero's</blockquote> <time itemprop="created_at" datetime="2018-07-07T23:44:05.363Z"></time></article>
  </div>`
const profile_as_text = `
<figure class="profile" itemid="/+16282281824" itemscope="itemscope" itemtype="/person">
  <svg>
    <defs itemprop="avatar"/><use xlink:href="#silhouette"/>
  </svg>
  <figcaption>
    <p>
      <span itemprop="first_name">katie</span>
      <span itemprop="last_name">caffey</span>
    </p>
    <a content="6282281824" href="sms:+16282281824" itemprop="mobile">(628) 228-1824</a>
  </figcaption>
</figure>
`
describe('@/views/Feed.vue', () => {
  it('render feed info', () => {
    let wrapper = shallow(Feed)
    expect(wrapper.element).toMatchSnapshot()
  })
  it('#populate_feed', () => {
    let relations = [{
      first_name: 'katie',
      last_name: 'caffey',
      mobile: '2134445566'
    }]
    let wrapper = shallow(Feed)
    wrapper.vm.populate_feed(relations).then(() => {
      expect(wrapper.vm.feed.length).toBe(5)
    })
  })
})
