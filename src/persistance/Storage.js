 // https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import * as firebase from 'firebase/app'
import 'firebase/auth'
import Local from '@/persistance/Local'
import Cloud from '@/persistance/Cloud'
import Paged from '@/persistance/Paged'
import { as_type } from '@/helpers/itemid'
import profile from '@/helpers/profile'

export default class Storage {
  constructor (itemid) {
    this.id = itemid
    this.type = as_type(itemid)
    this.metadata = { contentType: 'text/html' }
  }
}
export class Me extends Cloud(Local(Storage)) {
  constructor () {
    let me = localStorage.getItem('me')
    if (!me) {
      const user = firebase.auth().currentUser
      if (user) me = profile.from_e64(user.phoneNumber)
      else me = '/+'
      localStorage.setItem('me', me)
    }
    super(me)
  }
}
export class Relations extends Local(Storage) {
  constructor () { super(`${localStorage.getItem('me')}/relations`) }
}
export class Statements extends Paged(Cloud(Local(Storage))) {
  constructor () { super(`${localStorage.getItem('me')}/statements`) }
}
export class Events extends Paged(Cloud(Local(Storage))) {
  constructor () { super(`${localStorage.getItem('me')}/events`) }
}
export class Activity extends Cloud(Local(Storage)) {
  constructor () { super(`${localStorage.getItem('me')}/activity`) }
}
export class History extends Cloud(Storage) {
  async save (items) {
    console.info('History.save()', this.id)
    if (!items) return
    const user = firebase.auth().currentUser
    const path = `/people/${this.id}.html`
    if (user && navigator.onLine) {
      const file = new File([items.outerHTML], path)
      await firebase.storage().ref().child(path).put(file, this.metadata)
    }
  }
}
export class Admin extends Cloud(Storage) {}
export class Avatar extends Cloud(Local(Storage)) {}
export class Poster extends Cloud(Local(Storage)) {}
