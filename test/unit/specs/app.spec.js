import Vue from 'vue'
import ProfileActivity from '@/app'

describe('profile-activity.vue', () => {
  let Constructor

  beforeEach(() => {
    Constructor = Vue.extend(ProfileActivity)
  })

  it('should accept input for posts', () => {
    const vm = new Constructor().$mount()
    expect(vm.$el).toMatchSnapshot()
  })

  it('should list activity')
  it('should list posts')

})
