import Vue from 'vue'
import {shallow} from 'vue-test-utils'
import ActivityList from '@/components/activity-list'

describe('profile-activity.vue', () => {
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
    wrapper.setProps({activity: [event]}) // you can test watchers by setting props
    expect(wrapper.element).toMatchSnapshot()
  })

})
