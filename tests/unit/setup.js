import Vue from 'vue'
import * as firebase from 'firebase/app'
import 'firebase/storage'
import 'firebase/auth'
Vue.config.productionTip = false
global.fetch = require('jest-fetch-mock')
jest.spyOn(firebase, 'auth').mockImplementation(() => {
  return {
    currentUser: { phoneNumber: '+16282281824' },
    onAuthStateChanged: jest.fn(state_changed => state_changed())
  }
})
jest.spyOn(firebase, 'storage').mockImplementation(() => {
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
            }),
            listAll: jest.fn(_ => {
              return Promise.resolve({prefixes: []})
            })
          }
        })
      }
    })
  }
})
