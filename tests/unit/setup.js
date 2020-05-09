import Vue from 'vue'
Vue.config.productionTip = false
Vue.config.devtools = false
require('fake-indexeddb/auto')
require('jest-fetch-mock').enableMocks()
Vue.mixin({
  data () {
    return {
      me: localStorage.getItem('me')
    }
  }
})
console.info = function () {
  // do nothing therby gounding info into the dirt
}
