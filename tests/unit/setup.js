import Vue from 'vue'
Vue.config.productionTip = false
Vue.config.devtools = false
require('fake-indexeddb/auto')
require('jest-fetch-mock').enableMocks()
console.info = jest.fn()
console.time = jest.fn()
console.timeEnd = jest.fn()
