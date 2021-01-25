import Vue from 'vue'
import App from './App.vue'
import router from './router'
import './workers/register_service_worker'
const me = localStorage.me
if (!me) localStorage.me = '/+'
Vue.config.productionTip = false
new Vue({
  router,
  render: h => h(App)
}).$mount('#loading-realness')
