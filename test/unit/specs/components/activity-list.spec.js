import {shallow} from 'vue-test-utils'
import ActivityList from '@/components/activity-list'

describe('activity-list.vue', () => {
  let wrapper

  beforeEach(() => {
    wrapper = shallow(ActivityList)
  })

  it('should render an activity wrapper (ol#activity)', () => {
    expect(wrapper.element).toMatchSnapshot()
  })

  it('should render some activity', () => {
    const event = {
      who: '/users/uid',
      what: 'Created a post',
      why: 'unknown',
      when: '2017-12-20T23:01:14.310Z',
      where: '/posts/1'
    }
    wrapper.setData({activity: [event]})
    expect(wrapper.element).toMatchSnapshot()
  })

  it('should add an activity when post-added is emited', () => {
    const post = {
      created_at: '2017-12-20T23:01:14.310Z',
      articleBody: 'I like to move it'
    }
    expect(wrapper.vm.activity.length).toBe(0)
    wrapper.vm.$bus.$emit('post-added', post)
    expect(wrapper.vm.activity.length).toBe(1)
    expect(wrapper.find('li')).toBeTruthy()
  })

})
