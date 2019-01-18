import Vue from 'vue'
import * as firebase from 'firebase/app'
import 'firebase/storage'
Vue.prototype.$bus = new Vue({})
Vue.config.productionTip = false
global.fetch = require('jest-fetch-mock')
const storage_mock = jest.spyOn(firebase, 'storage').mockImplementation(() => {
  return {
    ref: jest.fn(() => {
      return {
        child: jest.fn(path => {
          let reference_path = path
          return {
            put: jest.fn(path => Promise.resolve(reference_path)),
            getDownloadURL: jest.fn(path => {
              // console.log('reference_path', reference_path)
              return Promise.resolve(`https://download_url${reference_path}`)
            })
          }
        })
      }
    })
  }
})
