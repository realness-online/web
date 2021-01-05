import firebase from 'firebase/app'
const mock_dir = {
  prefixes: [],
  items: [],
  path: '/a/fake/path'
}
firebase.storage_mock = {
  put: jest.fn(_ => Promise.resolve()),
  getDownloadURL: jest.fn(_ => Promise.resolve('/path/to/file.html')),
  listAll: jest.fn(_ => Promise.resolve(mock_dir)),
  delete: jest.fn(_ => Promise.resolve()),
  getMetadata: jest.fn(_ => Promise.resolve())
}
const meta_methods = {
  ref: jest.fn(() => {
    return {
      child: jest.fn(path => firebase.storage_mock)
    }
  })
}
firebase.storage = jest.fn(_ => meta_methods)
