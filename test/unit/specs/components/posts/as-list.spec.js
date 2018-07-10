import {shallow} from 'vue-test-utils'
import post_list from '@/components/posts/as-list'
import * as firebase from 'firebase/app'
import 'firebase/auth'

const not_signed_in = jest.fn(state_changed => state_changed())
const is_signed_in = jest.fn((state_changed) => {
  state_changed({
    phoneNumber: "6282281824"
  })
})
const storage_mock = jest.spyOn(firebase, 'storage').mockImplementation(() => {
  return {
    ref: jest.fn(() => {
      return {
        child: jest.fn(() => {
          return {
            put: jest.fn((path) => Promise.resolve(path)),
            getDownloadURL: jest.fn((path) => Promise.resolve('/example/path/file.html'))
          }
        })
      }
    })
  }
})
const server_text = `
  <div itemprop="posts" itemref="profile">
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">This is a word</blockquote> <time itemprop="created_at" datetime="2018-04-13T20:02:50.533Z"></time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">These are some words.</blockquote> <time itemprop="created_at" datetime="2018-07-05T23:25:58.145Z"></time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">I am writing some words right now testing some magical magic out</blockquote> <time itemprop="created_at" datetime="2018-07-07T20:13:42.760Z">2 days ago</time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">zipper faced monkey</blockquote> <time itemprop="created_at" datetime="2018-07-07T23:11:51.460Z"></time></article>
  </div>
  `
const local_text = `
  <div itemprop="posts" itemref="profile">
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">from the bottom of the zero's</blockquote> <time itemprop="created_at" datetime="2018-07-07T23:44:05.363Z"></time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">Now I'm syncing like a magic man</blockquote> <time itemprop="created_at" datetime="2018-07-07T23:45:52.437Z"></time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">saying some more stuff.</blockquote> <time itemprop="created_at" datetime="2018-07-08T00:40:11.686Z"></time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">oh my god words!</blockquote> <time itemprop="created_at" datetime="2018-07-08T00:41:28.585Z"></time></article>
  </div>
  `

describe('@/components/posts/as-list.vue', () => {
  let wrapper
  const post = {
    created_at: '2017-12-20T23:01:14.310Z',
    articleBody: 'I like to move it'
  }
  beforeEach(() => {
    wrapper = shallow(post_list)
  })
  it('should render (ol#activity)', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  it('should render some posts', () => {
    const post = {
      created_at: '2017-12-20T23:01:14.310Z',
      articleBody: 'I like to move it'
    }
    wrapper.setData({posts: [post]})
    expect(wrapper.element).toMatchSnapshot()
  })
  it('should add an activity when post-added is emited', () => {
    expect(wrapper.vm.posts.length).toBe(0)
    wrapper.vm.$bus.$emit('post-added', post)
    expect(wrapper.vm.posts.length).toBe(1)
    expect(wrapper.find('li')).toBeTruthy()
  })
  describe.only('#sync', () => {
    it('exists', () => {
      expect(wrapper.vm.sync).toBeDefined()
    })
    it('syncs posts from server to local storage', async () => {
      expect.assertions(1)
      fetch.mockResponseOnce(server_text)
      localStorage.setItem('posts', local_text)
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged: is_signed_in }
      })
      let posts = wrapper.vm.sync()
      console.log(posts);
      wrapper.vm.$nextTick(() => {
        expect(wrapper.vm.posts.length).toBe(8)
      })

    })
  })
  })
