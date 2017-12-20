import Vue from 'vue'
import ProfileActivity from '@/components/profile-activity'

describe('profile-activity.vue', () => {
  let Constructor

  beforeEach(() => {
    Constructor = Vue.extend(ProfileActivity)
  })

  it('should render ol#activity', () => {
    const vm = new Constructor().$mount()
    expect(vm.$el).toMatchSnapshot()
  })

  it('should render some activity', () => {
    let event = {
      who: '/users/uid',
      what: 'Created a post',
      why: 'unknown',
      when: '2017-12-20T23:01:14.310Z',
      where: '/posts/1'
    }
    const vm = new Constructor({
      propsData: {
        activity: [event]
      }

    }).$mount()
    // expect(cmp.element).toMatchSnapshot()
    expect(vm.$el).toMatchSnapshot()
  })

})
