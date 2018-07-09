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
    it('syncs posts from server to local storage', () => {
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged: is_signed_in }
      })
      wrapper.vm.sync()
    })
  })
  })
