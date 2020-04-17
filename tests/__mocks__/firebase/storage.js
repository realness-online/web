import * as firebase from 'firebase/app'

function storage() {
  return {
    ref: jest.fn(() => {
      return {
        child: jest.fn(path => {
          const reference_path = path
          return {
            put: jest.fn(() => Promise.resolve(reference_path)),
            getDownloadURL: jest.fn(() => {
              // console.log('reference_path', reference_path)
              return Promise.resolve(`https://example.com${reference_path}`)
            }),
            listAll: jest.fn(() => {
              console.log('reference_path', reference_path)
              return Promise.resolve({ prefixes: [], items: [], path: reference_path })
            })
          }
        })
      }
    })
  }
}
firebase.storage = storage
