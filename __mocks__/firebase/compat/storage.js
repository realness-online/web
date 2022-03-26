import firebase from 'firebase/compat/app'
const mock_dir = {
  prefixes: [],
  items: [],
  path: '/a/fake/path'
}
firebase.storage_mock = {
  putString: vi.fn(() => Promise.resolve()),
  getDownloadURL: vi.fn(() => Promise.resolve('/path/to/file.html')),
  listAll: vi.fn(() => Promise.resolve(mock_dir)),
  delete: vi.fn(() => Promise.resolve()),
  getMetadata: vi.fn(() => Promise.resolve())
}
const meta_methods = {
  ref: vi.fn(() => {
    return {
      child: vi.fn(() => firebase.storage_mock)
    }
  })
}
firebase.storage = vi.fn(() => meta_methods)
