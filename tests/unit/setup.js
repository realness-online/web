import Vue from 'vue'
Vue.config.productionTip = false
Vue.config.devtools = false
require('fake-indexeddb/auto')
require('jest-fetch-mock').enableMocks()
console.info = function () {
  // do nothing therby gounding info into the dirt
}
