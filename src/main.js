import Vue from 'vue'
import App from './App.vue'
import router from './router'
import './register_service_worker'
let me = localStorage.getItem('me')
if (!me) {
  me = '/+'
  localStorage.setItem('me', me)
}
Vue.config.productionTip = false
Vue.mixin({
  data () {
    return { me }
  }
})
new Vue({
  router,
  render: h => h(App)
}).$mount('#loading-realness')
