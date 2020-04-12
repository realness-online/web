import * as firebase from 'firebase/app'

function storage() {
  return {
    ref: jest.fn(() => {
      return {
        child: jest.fn(path => {
          const reference_path = path
          return {
            put: jest.fn(path => Promise.resolve(reference_path)),
            getDownloadURL: jest.fn(path => {
              // console.log('reference_path', reference_path)
              return Promise.resolve(`https://download_url${reference_path}`)
            }),
            listAll: jest.fn(_ => {
              return Promise.resolve({ prefixes: [] })
            })
          }
        })
      }
    })
  }
}
firebase.storage = storage
