 // https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import * as firebase from 'firebase/app'
import 'firebase/auth'
import Local from '@/persistance/Local'
import Large from '@/persistance/Large'
import Cloud from '@/persistance/Cloud'
import Paged from '@/persistance/Paged'
import { as_type } from '@/helpers/itemid'
export default class Storage {
  constructor (itemid) {
    this.id = itemid
    this.type = as_type(itemid)
    this.metadata = { contentType: 'text/html' }
  }
}
export class Avatar extends Large(Cloud(Storage)) {}
export class Poster extends Large(Cloud(Storage)) {}
export class Me extends Cloud(Local(Storage)) {
  constructor () { super(localStorage.me) }
}
export class Relations extends Local(Storage) {
  constructor () { super(`${localStorage.me}/relations`) }
}
export class Statements extends Paged(Cloud(Local(Storage))) {
  constructor () { super(`${localStorage.me}/statements`) }
}
export class Events extends Paged(Cloud(Local(Storage))) {
  constructor () { super(`${localStorage.me}/events`) }
}
export class Activity extends Cloud(Local(Storage)) {
  constructor () { super(`${localStorage.me}/activity`) }
}
export class History extends Cloud(Storage) {
  async save (items) { // on purpose doesn't call super.save
    if (!items) return
    if (firebase.auth().currentUser && navigator.onLine) {
      const path = `/people/${this.id}.html`
      const file = new File([items.outerHTML], path)
      await firebase.storage().ref().child(path).put(file, this.metadata)
    }
  }
}
