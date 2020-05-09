import * as firebase from 'firebase/app'
export const put_mock = jest.fn(reference => Promise.resolve(reference))
export const delete_mock = jest.fn(reference => Promise.resolve(reference))
export const getDownloadURL_mock = jest.fn(() => Promise.resolve('/path/to/file.html'))
export const listAll_mock = jest.fn(reference_path => {
  return Promise.resolve({ prefixes: [], items: [], path: reference_path })
})
function storage () {
  return {
    ref: jest.fn(() => {
      return {
        child: jest.fn(path => {
          const reference_path = path
          return {
            put: put_mock,
            getDownloadURL: getDownloadURL_mock,
            listAll: listAll_mock,
            delete: delete_mock
          }
        })
      }
    })
  }
}
firebase.storage = storage
