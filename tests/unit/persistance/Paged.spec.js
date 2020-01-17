import Item from '@/modules/Item'
import Storage, { posts_storage } from '@/persistance/Storage'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import flushPromises from 'flush-promises'
const fs = require('fs')
const posts = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')
const hella_posts = fs.readFileSync('./tests/unit/html/hella_posts.html', 'utf8')
describe('@/persistance/Paged.js', () => {
  afterEach(() => {
    localStorage.clear()
  })
  describe('#sync_list', () => {
    let posts_storage
    beforeEach(() => {
      posts_storage = new Storage('posts', '[itemprop=posts]')
    })
    it('Exists', () => {
      expect(posts_storage.sync_list).toBeDefined()
    })
    it('Syncs posts from server to local storage', async() => {
      localStorage.setItem(posts_storage.filename, hella_posts)
      fetch.mockResponseOnce(posts)

      const server_list = Item.get_items(posts)
      expect(server_list.length).toBe(9)

      const local_list = Item.get_items(posts_storage.from_local())
      expect(local_list.length).toBe(79)

      const list = await posts_storage.sync_list()
      // 3 posts are the same 25 posts are older then will sync
      // 9 + 79 - 3 = 60
      expect(list.length).toBe(60)
    })
  })
  describe('#optimize', () => {
    it('Exists', () => {
      expect(posts_storage.optimize).toBeDefined()
    })
    it('It optimizes a list of items accross a set of pages', async() => {
      localStorage.setItem(posts_storage.filename, hella_posts)
      await posts_storage.optimize()
      // console.log(localStorage.__STORE__);
      expect(Object.keys(localStorage.__STORE__).length).toBe(3)
    })
  })
})
