import firebase from 'firebase/app'
const mock_dir = {
  prefixes: [],
  items: [],
  path: '/a/fake/path'
}
firebase.storage_mock = {
  putString: jest.fn(() => Promise.resolve()),
  getDownloadURL: jest.fn(() => Promise.resolve('/path/to/file.html')),
  listAll: jest.fn(() => Promise.resolve(mock_dir)),
  delete: jest.fn(() => Promise.resolve()),
  getMetadata: jest.fn(() => Promise.resolve())
}
const meta_methods = {
  ref: jest.fn(() => {
    return {
      child: jest.fn(() => firebase.storage_mock)
    }
  })
}
firebase.storage = jest.fn(() => meta_methods)
