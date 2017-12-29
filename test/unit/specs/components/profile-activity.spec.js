import Vue from 'vue'
import { shallow } from 'vue-test-utils'
import ProfileActivity from '@/components/profile-activity'

describe('profile-activity.vue', () => {
  let wrapper

  beforeEach(() => {
    wrapper = shallow(ProfileActivity)
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

    wrapper = shallow(ProfileActivity, {
      propsData: {
        activity: [event]
      }
    })
    expect(wrapper.element).toMatchSnapshot()
  })

})
