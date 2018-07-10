import Vue from 'vue'
Vue.prototype.$bus = new Vue({})
Vue.config.productionTip = false
global.fetch = require('jest-fetch-mock')
