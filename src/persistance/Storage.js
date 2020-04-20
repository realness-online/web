 // https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import Item from '@/modules/item'
import Local from '@/persistance/Local'
import Cloud from '@/persistance/Cloud'
import Paged from '@/persistance/Paged'
import profile from '@/helpers/profile'

export default class Storage {
  constructor (itemid) {
    this.id = itemid
    this.metadata = { contentType: 'text/html' }
  }
}
export class Person extends Cloud(Local(Storage)) {
  constructor (itemid = null) {
    if (itemid) return super(itemid)
    let me = localStorage.getItem('me')
    if (me) return ths.super(me)
    me = firebase.auth().currentUser
    if (me) return this.super(profile.from_e64(me.phoneNumber))
  }
}
export class Relations extends Local(Storage) {}
export class Posts extends Paged(Cloud(Local(Storage))) {}
export class Events extends Paged(Cloud(Local(Storage))) {}
export class History extends Paged(Cloud(Local(Storage))) {}
export class Activity extends Cloud(Local(Storage)) {}
export class SVG extends Cloud(Local(Storage)) {}
export class Avatar extends SVG {}
export class Poster extends SVG {}
