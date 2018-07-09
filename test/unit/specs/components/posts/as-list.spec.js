import {shallow} from 'vue-test-utils'
import post_list from '@/components/posts/as-list'

describe('@/components/posts-list.vue', () => {
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
  describe('#sync', () => {
    beforeEach(() => {
      // const onAuthStateChanged = jest.fn(state_changed => state_changed())
      const onAuthStateChanged = jest.fn(state_changed => {
        state_changed({user: person})
      })

      let auth_mock = jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged }
      })

      let storage_mock = jest.spyOn(firebase, 'storage').mockImplementation(() => {
        return {
          ref: jest.fn(() => {
            return {
              child: jest.fn(() => {
                return {
                  getDownloadURL: jest.fn(() => Promise.resolve('http://example.com/file.html'))
                }
              })
            }
          })
        }
      })

    })
    it('exists', () => {
      expect(person.sync).toBeDefined()
    })
    it('syncs posts from server to local storage', () => {
      person.sync()
    })
  })
  })
