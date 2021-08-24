import firebase from 'firebase/app'
import 'firebase/auth'
import flushPromises from 'flush-promises'
import { get, set } from 'idb-keyval'

import get_item, { hydrate } from '@/modules/item'
import * as itemid from '@/helpers/itemid'
import { Statements } from '@/persistance/Storage' // statements extends Paged
import { itemid_as_kilobytes, elements_as_kilobytes, is_fat } from '@/persistance/Paged'

const fs = require('fs')
const statements = fs.readFileSync('./tests/unit/html/statements.html', 'utf8')
const hella_statements = fs.readFileSync('./tests/unit/html/statements-hella.html', 'utf8')
const offline_statements = fs.readFileSync('./tests/unit/html/statements-offline.html', 'utf8')
const user = { phoneNumber: '/+16282281824' }

describe('@/persistance/Paged.js', () => {
  let paged
  beforeEach(() => {
    get.mockImplementation(_ => Promise.resolve({}))
    set.mockImplementation(_ => Promise.resolve(null))
    localStorage.me = '/+16282281824'
    paged = new Statements()
  })
  afterEach(() => {
    localStorage.clear()
  })
  describe('Methods', () => {
    describe('#sync', () => {
      let cloud_spy, local_spy
      beforeAll(() => {
        expect(get_item(statements).statements.length).toBe(20)
        expect(get_item(hella_statements).statements.length).toBe(100)
      })
      beforeEach(() => {
        cloud_spy = jest.spyOn(itemid, 'load_from_network')
                    .mockImplementation(_ => Promise.resolve(get_item(statements)))
        local_spy = jest.spyOn(itemid, 'list')
                    .mockImplementation(_ => Promise.resolve(get_item(hella_statements).statements))
        localStorage.setItem('/+/statements', offline_statements)
      })
      it('Exists', () => {
        expect(paged.sync).toBeDefined()
      })
      it('Fails gracefully if their are no cloud items', async () => {
        const empty_cloud = {
          id: '/+16282281824/statements'
        }
        cloud_spy.mockImplementationOnce(_ => Promise.resolve(empty_cloud))
        firebase.user = user
        const list = await paged.sync()
        expect(list.length).toBe(101)
      })
      it('Syncs statements from server to local storage', async () => {
        firebase.user = user
        const list = await paged.sync()
        expect(cloud_spy).toBeCalled()
        expect(local_spy).toBeCalled()
        // expect(anonymous_spy).toBeCalled()
        // 100 local statements - 20 were optimized away on another device
        // 100 - 20 = 80
        // 20 - 10 = 10
        // 80 + 10 = 90
        // 90 + 1 = 91
        // 20 optimized away, 70 new local statements, 10 unsynced statements in the cloud
        // 1 statement that was made while anonymous
        expect(list.length).toBe(91)
        firebase.user = null
      })
      it('Syncs if there are no server items', async () => {
        firebase.user = user
        cloud_spy = jest.spyOn(itemid, 'load_from_network')
                        .mockImplementationOnce(_ => null)
        const list = await paged.sync()
        expect(cloud_spy).toBeCalled()
        expect(local_spy).toBeCalled()
        expect(list.length).toBe(101)
      })
      it('Syncs if there are no local items', async () => {
        firebase.user = user
        itemid.list.mockReset()
        local_spy = jest.spyOn(itemid, 'list').mockImplementationOnce(_ => Promise.resolve([]))
        const list = await paged.sync()
        expect(cloud_spy).toBeCalled()
        expect(local_spy).toBeCalled()
        expect(list.length).toBe(21)
      })
    })
    describe('#optimize', () => {
      beforeEach(() => {
        localStorage.setItem(paged.id, hella_statements)
        jest.spyOn(itemid, 'load').mockImplementation(_ => Promise.resolve(get_item(hella_statements)))
      })
      it('Exists', () => {
        expect(paged.optimize).toBeDefined()
      })
      it('It optimizes a list of items accross a set of pages', async () => {
        firebase.user = user
        localStorage.setItem(paged.id, hella_statements)
        const save_spy = jest.spyOn(paged, 'save')
        expect(Object.keys(localStorage.__STORE__).length).toBe(2)
        await paged.optimize()
        await flushPromises()
        expect(Object.keys(localStorage.__STORE__).length).toBe(2)
        expect(save_spy).toHaveBeenCalledTimes(2)
        firebase.user = null
      })
      it('It fails gracefully', async () => {
        localStorage.setItem(paged.id, '')
        expect(Object.keys(localStorage.__STORE__).length).toBe(2)
        await paged.optimize()
        expect(Object.keys(localStorage.__STORE__).length).toBe(2)
      })
    })
    describe('#itemid_as_kilobytes', () => {
      it('Exists', () => {
        expect(itemid_as_kilobytes).toBeDefined()
      })
      it('Tells the size of the item in local storage', () => {
        localStorage.setItem(paged.id, statements)
        expect(itemid_as_kilobytes(paged.id)).toBe('4.14')
      })
      it('Returns zero if nothing in storage', () => {
        expect(itemid_as_kilobytes(paged.id)).toBe(0)
      })
    })
    describe('#is_fat', () => {
      it('Only prunes for older then today', () => {
        expect(is_fat(hydrate(offline_statements), 'statements')).toBe(false)
      })
    })
    describe('#elements_as_kilobytes', () => {
      it('Returns zero when there are no elements', () => {
        expect(elements_as_kilobytes()).toBe(0)
      })
    })
  })
})
