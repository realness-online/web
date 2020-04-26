import Item from '@/modules/Item'
import * as itemid from '@/helpers/itemid'
import { Posts } from '@/persistance/Storage' //posts extends Paged
import { as_kilobytes } from '@/persistance/Paged'
const fs = require('fs')
const posts = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')
const hella_posts = fs.readFileSync('./tests/unit/html/hella_posts.html', 'utf8')
const fetch = require('jest-fetch-mock')
describe ('@/persistance/Paged.js', () => {
  let paged
  beforeEach(() => {
    paged = new Posts('/+16282281824/posts')
  })
  afterEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })
  describe ('#sync_list', () => {
    let cloud_spy, local_spy

    beforeEach(() => {
      console.log(Item.get_items(posts), paged.id)
      const network = {
        id: paged.id,
        type: 'posts',
        posts: Item.get_items(posts)
      }
      const local = {
        id: paged.id,
        type: 'posts',
        posts: Item.get_items(hella_posts)
      }
      cloud_spy = jest.spyOn(itemid, 'load_from_network').mockImplementation(() => network)
      local_spy = jest.spyOn(itemid, 'load').mockImplementation(() => local)
    })
    it ('Exists', () => {
      expect(paged.sync_list).toBeDefined()
    })

    it.only ('Syncs posts from server to local storage', async () => {
      // expect(posts_as_list.length).toBe(9)
      // expect(hella_as_list.length).toBe(79)
      const list = await paged.sync_list()
      expect(cloud_spy).toBeCalled()
      expect(local_spy).toBeCalled()
      // 79 local posts - 25 were optimized away on another device
      // 9 posts from the cloud 3 of which are shared between local and cloud
      // 79 - 25 = 54
      // 9 - 3 = 6
      // 54 + 6 = 60
      // 54 unsynced posts locally 6 unsynced posts in the cloud
      console.log(list)
      expect(list.posts.length).toBe(60)
    })
    it('syncs if there are no server items', async () => {
      cloud_spy = jest.spyOn(itemid, 'load_from_network')
                      .mockImplementationOnce(() => [])
      expect(posts_as_list.length).toBe(9)
      expect(hella_as_list.length).toBe(79)
      const list = await paged.sync_list()
      expect(cloud_spy).toBeCalled()
      expect(local_spy).toBeCalled()
      expect(list.length).toBe(79)
    })
    it('syncs if there are no local items', async () => {
      cloud_spy = jest.spyOn(itemid, 'load')
                      .mockImplementationOnce(() => [])
      expect(posts_as_list.length).toBe(9)
      expect(hella_as_list.length).toBe(79)
      const list = await paged.sync_list()
      expect(cloud_spy).toBeCalled()
      expect(local_spy).toBeCalled()
      expect(list.length).toBe(9)
    })
  })
  describe ('#optimize', () => {
    const hella_as_list = Item.get_items(hella_posts)
    let load_spy
    beforeEach(() => {
      localStorage.setItem(paged.id, hella_posts)
      load_spy = jest.spyOn(itemid, 'load')
                     .mockImplementation(() => hella_as_list)
    })
    it ('Exists', () => {
      expect(paged.optimize).toBeDefined()
    })
    it ('It optimizes a list of items accross a set of pages', async () => {
      localStorage.setItem(paged.id, hella_posts)
      await paged.optimize()
      console.log(Object.keys(localStorage.__STORE__))
      expect(Object.keys(localStorage.__STORE__).length).toBe(3)
    })
  })
  describe ('#as_kilobytes', () => {
    it ('Exists', () => {
      expect(as_kilobytes).toBeDefined()
    })
    it ('Tells the size of the item in local storage', () => {
      localStorage.setItem(paged.id, posts)
      expect(as_kilobytes(paged.id)).toBe('2.01')
    })
    it ('returns zero if nothing in storage', () => {
      expect(as_kilobytes(paged.id)).toBe(0)
    })
  })
})
