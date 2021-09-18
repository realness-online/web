import Vue from 'vue'
import VueHotkey from 'v-hotkey'
Vue.use(VueHotkey)
Vue.config.productionTip = false
Vue.config.devtools = false
require('fake-indexeddb/auto')
require('jest-fetch-mock').enableMocks()
console.info = jest.fn()
console.time = jest.fn()
console.trace = jest.fn()
console.timeEnd = jest.fn()
