import {shallow} from 'vue-test-utils'
import Storage from '@/modules/Storage'
import feed from '@/pages/feed'
const server_text = `
  <div itemprop="posts" itemref="profile">
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">This is a word</blockquote> <time itemprop="created_at" datetime="2018-04-13T20:02:50.533Z"></time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">These are some words.</blockquote> <time itemprop="created_at" datetime="2018-07-05T23:25:58.145Z"></time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">I am writing some words right now testing some magical magic out</blockquote> <time itemprop="created_at" datetime="2018-07-07T20:13:42.760Z">2 days ago</time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">zipper faced monkey</blockquote> <time itemprop="created_at" datetime="2018-07-07T23:11:51.460Z"></time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">from the bottom of the zero's</blockquote> <time itemprop="created_at" datetime="2018-07-07T23:44:05.363Z"></time></article>
  </div>`
describe('@/pages/feed.vue', () => {
  it('render feed info', () => {
    let wrapper = shallow(feed)
    expect(wrapper.element).toMatchSnapshot()
  })
  it('#posts_url', () => {
    expect.assertions(1)
    let wrapper = shallow(feed)
    let person = {
      mobile: '4152223666'
    }
    wrapper.vm.posts_url(person).then(url => {
      expect(url).toBe('https://download_url/people/+14152223666/posts.html')
    })
  })
  it('#sort_feed', () => {
    expect.assertions(1)
    let wrapper = shallow(feed)
    wrapper.setData({
      feed: [
        {
          name: 'later',
          created_at: '2018-05-19T20:27:30.118Z'
        },
        {
          name: 'earlier',
          created_at: '2017-05-19T20:27:30.118Z'
        }
      ]
    })
    wrapper.vm.sort_feed()
    expect(wrapper.vm.feed[1].name).toBe('later')
  })
  it('#insert_me_into_my_posts', () => {
    expect.assertions(2)
    let wrapper = shallow(feed)
    jest.spyOn(Storage.prototype, 'as_list').mockImplementation(() => {
      return [{}]
    })
    jest.spyOn(Storage.prototype, 'as_object').mockImplementation(() => {
      return {first_name: 'scott'}
    })
    wrapper.vm.insert_me_into_my_posts()
    expect(wrapper.vm.feed.length).toBe(1)
    expect(wrapper.vm.feed[0].person.first_name).toBe('scott')
  })
  it('#add_relations_to_feed', () => {
    expect.assertions(1)
    fetch.mockResponseOnce(server_text)
    let relation = {
      first_name: 'katie',
      last_name: 'caffey',
      mobile: '2134445566'
    }
    let wrapper = shallow(feed)
    jest.spyOn(Storage.prototype, 'as_list').mockImplementation(() => {
      return [relation]
    })
    wrapper.vm.add_relations_to_feed().then(() => {
      expect(wrapper.vm.feed.length).toBe(5)
    })
  })
})
