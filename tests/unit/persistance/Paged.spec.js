import get_item from '@/modules/item'
import * as itemid from '@/helpers/itemid'
import { Statements } from '@/persistance/Storage' //statements extends Paged
import { as_kilobytes } from '@/persistance/Paged'
const fs = require('fs')
const statements = fs.readFileSync('./tests/unit/html/statements.html', 'utf8')
const hella_statements = fs.readFileSync('./tests/unit/html/hella_statements.html', 'utf8')
const fetch = require('jest-fetch-mock')
describe ('@/persistance/Paged.js', () => {
  let paged
  beforeEach(() => {
    paged = new Statements('/+16282281824/statements')
  })
  afterEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })
  describe ('#sync_list', () => {
    let cloud_spy, local_spy
    beforeEach(() => {
      cloud_spy = jest.spyOn(itemid, 'load_from_network').mockImplementation(() => get_item(statements))
      local_spy = jest.spyOn(itemid, 'load').mockImplementation(() => get_item(hella_statements))
    })
    it ('Exists', () => {
      expect(paged.sync_list).toBeDefined()
    })

    it ('Syncs statements from server to local storage', async () => {
      expect(get_item(statements).statements.length).toBe(9)
      expect(get_item(hella_statements).statements.length).toBe(79)
      const list = await paged.sync_list()
      expect(cloud_spy).toBeCalled()
      expect(local_spy).toBeCalled()
      // 79 local statements - 25 were optimized away on another device
      // 9 statements from the cloud 3 of which are shared between local and cloud
      // 79 - 25 = 54
      // 9 - 3 = 6
      // 54 + 6 = 60
      // 54 unsynced statements locally 6 unsynced statements in the cloud
      expect(list.length).toBe(60)
    })
    it ('syncs if there are no server items', async () => {
      const mock_statements = { statements: [] }
      cloud_spy = jest.spyOn(itemid, 'load_from_network')
                      .mockImplementationOnce(() => mock_statements)
      const list = await paged.sync_list()
      expect(cloud_spy).toBeCalled()
      expect(local_spy).toBeCalled()
      expect(list.length).toBe(79)
    })
    it ('syncs if there are no local items', async () => {
      const mock_statements = { statements: [] }
      cloud_spy = jest.spyOn(itemid, 'load')
                      .mockImplementationOnce(() => mock_statements)
      const list = await paged.sync_list()
      expect(cloud_spy).toBeCalled()
      expect(local_spy).toBeCalled()
      expect(list.length).toBe(9)
    })
  })
  describe ('#optimize', () => {
    let load_spy
    beforeEach(() => {
      localStorage.setItem(paged.id, hella_statements)
      load_spy = jest.spyOn(itemid, 'load')
                     .mockImplementation(() => get_item(hella_statements))
    })
    it ('Exists', () => {
      expect(paged.optimize).toBeDefined()
    })
    it ('It optimizes a list of items accross a set of pages', async () => {
      localStorage.setItem(paged.id, hella_statements)
      expect(Object.keys(localStorage.__STORE__).length).toBe(1)
      await paged.optimize()
      // set's one for me
      expect(Object.keys(localStorage.__STORE__).length).toBe(3)
    })
    it ('It fails gracefully', async () => {
      localStorage.setItem(paged.id, '')
      expect(Object.keys(localStorage.__STORE__).length).toBe(1)
      await paged.optimize()

      expect(Object.keys(localStorage.__STORE__).length).toBe(1)
    })
  })
  describe ('#as_kilobytes', () => {
    it ('Exists', () => {
      expect(as_kilobytes).toBeDefined()
    })
    it ('Tells the size of the item in local storage', () => {
      localStorage.setItem(paged.id, statements)
      expect(as_kilobytes(paged.id)).toBe('2.04')
    })
    it ('returns zero if nothing in storage', () => {
      expect(as_kilobytes(paged.id)).toBe(0)
    })
  })
})
