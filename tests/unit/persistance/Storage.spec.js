import * as firebase from 'firebase/app'
import 'firebase/auth'
import Storage, { Me } from '@/persistance/Storage'
const fs = require('fs')

describe('@/persistance/Storage.js', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
  })
  describe('Storage', () => {
    it('sets the id from the itemid', () => {
      const human = new Storage('/scott/fryxell')
      expect(human.id).toBe('/scott/fryxell')
    })
    it('has metadata', () => {
      const human = new Storage('/scott/fryxell')
      expect(human.metadata.contentType).toBe('text/html')
    })
  })
  describe('Me', () => {
    it('gets me from local storage', () => {
      localStorage.setItem('me', '/+16282281824')
      expect(new Me().id).toBe('/+16282281824')
      expect(localStorage.getItem).toBeCalled()
    })
    it('gets me from firebase.auth().currentUser', () => {
      expect(localStorage.getItem('me')).toBe(null)
      expect(new Me().id).toBe('/+16282281824')
      expect(localStorage.getItem('me')).toBe('/+16282281824')
    })
    it('Returns an apropriage object for new users', () => {
      const signed_out = { currentUser: null }
      jest.spyOn(firebase, 'auth').mockImplementationOnce(() => signed_out)
      expect(localStorage.getItem('me')).toBe(null)
      const me = new Me()
      expect(me.id).toBe(undefined)
      expect(me.type).toBe('person')
      expect(localStorage.getItem('me')).toBe(null)
    })
  })
})
