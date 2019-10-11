import Vue from 'vue'
import App from './App.vue'
import router from './router'
import './register_service_worker'
Vue.config.productionTip = false
new Vue({
  router,
  render: h => h(App)
}).$mount('#loading-realness')
