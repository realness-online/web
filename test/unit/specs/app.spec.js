import Vue from 'vue'
import { shallow } from 'vue-test-utils'
import App from '@/App'

describe('App.vue', () => {

  it('renders layout for the application', () => {
    let app = shallow(App)
    expect(app.element).toMatchSnapshot()
  })

  it('add_post() exists', () => {
    expect(typeof App.methods.add_post).toBe('function')
  })

  it('add_post creates a post', () => {

    let app = shallow(App, {
      data: {
        activity:[],
        posts:[],
        new_post:'I like to move it.'
      }
    })
    expect(app.vm.activity.length).toBe(0)
    expect(app.vm.posts.length).toBe(0)
    app.vm.add_post()
    expect(app.vm.posts.length).toBe(1)
    expect(app.vm.activity.length).toBe(1)
  })

  it('add_post only adds a post when there is text',() => {
    let app = shallow(App, {
      data: {
        activity:[],
        posts:[],
        new_post:''
      }
    })
    expect(app.vm.posts.length).toBe(0)
    expect(app.vm.activity.length).toBe(0)
    app.vm.add_post()
    expect(app.vm.posts.length).toBe(0)
    expect(app.vm.activity.length).toBe(0)
  })

})
