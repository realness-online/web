import { shallowMount } from '@vue/test-utils'
import Sign_on from '@/views/Sign-on'
describe('@/views/Sign-on.vue', () => {
  it('Renders a form for signing on to the app', () => {
    localStorage.me = '/+6282281823'
    const wrapper = shallowMount(Sign_on)
    expect(wrapper.element).toMatchSnapshot()
  })
  it.todo('Returns to the page user was on when they decided to join')
  it.todo('Asks new users for their name')
  it.todo('Takes a new user to the account page')
})
