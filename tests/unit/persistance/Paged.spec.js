import get_item from '@/modules/item'
import * as itemid from '@/helpers/itemid'
import { Statements } from '@/persistance/Storage' // statements extends Paged
import { as_kilobytes } from '@/persistance/Paged'
const fs = require('fs')
const statements = fs.readFileSync('./tests/unit/html/statements.html', 'utf8')
const hella_statements = fs.readFileSync('./tests/unit/html/hella_statements.html', 'utf8')
describe('@/persistance/Paged.js', () => {
  let paged
  beforeEach(() => {
    paged = new Statements('/+16282281824/statements')
  })
  afterEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })
  describe('#sync_list', () => {
    let cloud_spy, local_spy
    beforeEach(() => {
      cloud_spy = jest.spyOn(itemid, 'load_from_network').mockImplementation(() => Promise.resolve(get_item(statements)))
      local_spy = jest.spyOn(itemid, 'list').mockImplementation(() => Promise.resolve(get_item(hella_statements).statements))
    })
    it('Exists', () => {
      expect(paged.sync_list).toBeDefined()
    })
    it.only('Syncs statements from server to local storage', async () => {
      expect(get_item(statements).statements.length).toBe(20)
      expect(get_item(hella_statements).statements.length).toBe(100)
      const list = await paged.sync_list()
      expect(cloud_spy).toBeCalled()
      expect(local_spy).toBeCalled()
      // 100 local statements - 20 were optimized away on another device
      // 9 statements from the cloud 3 of which are shared between local and cloud
      // 100 - 20 = 80
      // 20 - 10 = 10
      // 80 + 10 = 90
      // 20 optimized away, 70 new local statements, 10 unsynced statements in the cloud
      expect(list.length).toBe(90)
    })
    it('syncs if there are no server items', async () => {
      const mock_statements = { statements: [] }
      cloud_spy = jest.spyOn(itemid, 'load_from_network')
                      .mockImplementationOnce(() => mock_statements)
      const list = await paged.sync_list()
      expect(cloud_spy).toBeCalled()
      expect(local_spy).toBeCalled()
      expect(list.length).toBe(100)
    })
    it('syncs if there are no local items', async () => {
      const mock_statements = { statements: [] }
      cloud_spy = jest.spyOn(itemid, 'load')
                      .mockImplementationOnce(() => mock_statements)
      const list = await paged.sync_list()
      expect(cloud_spy).toBeCalled()
      expect(local_spy).toBeCalled()
      expect(list.length).toBe(20)
    })
  })
  describe('#optimize', () => {
    beforeEach(() => {
      localStorage.setItem(paged.id, hella_statements)
      jest.spyOn(itemid, 'load')
          .mockImplementation(() => get_item(hella_statements))
    })
    it('Exists', () => {
      expect(paged.optimize).toBeDefined()
    })
    it('It optimizes a list of items accross a set of pages', async () => {
      localStorage.setItem(paged.id, hella_statements)
      expect(Object.keys(localStorage.__STORE__).length).toBe(1)
      await paged.optimize()
      // set's one for me
      expect(Object.keys(localStorage.__STORE__).length).toBe(3)
    })
    it('It fails gracefully', async () => {
      localStorage.setItem(paged.id, '')
      expect(Object.keys(localStorage.__STORE__).length).toBe(1)
      await paged.optimize()

      expect(Object.keys(localStorage.__STORE__).length).toBe(1)
    })
  })
  describe('#as_kilobytes', () => {
    it('Exists', () => {
      expect(as_kilobytes).toBeDefined()
    })
    it('Tells the size of the item in local storage', () => {
      localStorage.setItem(paged.id, statements)
      expect(as_kilobytes(paged.id)).toBe('4.14')
    })
    it('returns zero if nothing in storage', () => {
      expect(as_kilobytes(paged.id)).toBe(0)
    })
  })
})
