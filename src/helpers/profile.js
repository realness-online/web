import Item from '@/modules/item'
import { get_download_url } from '@/storage/Cloud'
import * as firebase from 'firebase/app'
import 'firebase/storage'
export default {
  async load(id) {
    const people = await this.items(id, 'index')
    if (people.length >= 1) {
      const person = people[0]
      person.id = id
      return person
    } else return { id }
  },
  async items(id, item_id) {
    const url = await get_download_url(id, `${item_id}.html`)
    const server_text = await (await fetch(url)).text()
    return Item.get_items(server_text)
  },
  async item(id, item_id) {
    return (await this.items(id, item_id))[0]
  },
  async directory(id, type) {
    const storage = firebase.storage().ref()
    const path = `/people/${id}/${type}`
    if (navigator.onLine) {
      return storage.child(path).listAll()
    } else return null
  },
  as_query_id(id = '/+') {
    return id.substring(2)
  },
  as_avatar_id(id = 'avatar_') {
    return `avatar_${this.as_query_id(id)}`
  },
  as_avatar_fragment(id = 'avatar_') {
    return `#${this.as_avatar_id(id)}`
  },
  as_fragment(id) {
    return `#${this.as_query_id(id)}`
  },
  as_phone_number(id = '/+1') {
    return id.substring(3)
  },
  from_phone_number(phone_number) {
    return `/+1${phone_number}`
  },
  from_e64(e64_number) {
    return `/${e64_number}`
  }
}
