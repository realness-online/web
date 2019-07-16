import * as firebase from 'firebase/app'
import Item from '@/modules/item'
import Storage from '@/modules/Storage'
import 'firebase/storage'
function get_url(person_id, type) {
  const path = `/people${person_id}/${type}.html`
  return firebase.storage().ref().child(path).getDownloadURL()
}
export default {
  async load(profile_id) {
    const item = (await this.items(profile_id, 'person'))[0]
    item.id = profile_id
    return item
  },
  async items(profile_id, type) {
    const url = await get_url(profile_id, type)
    const server_text = await (await fetch(url)).text()
    return Item.get_items(Storage.hydrate(server_text))
  },
  as_query_id(profile_id = '/+') {
    return profile_id.substring(2)
  },
  as_avatar_id(profile_id = 'avatar_') {
    return `avatar_${this.as_query_id(profile_id)}`
  },
  as_avatar_fragment(profile_id = 'avatar_') {
    return `#${this.as_avatar_id(profile_id)}`
  },
  as_fragment(profile_id) {
    return `#${this.as_query_id(profile_id)}`
  },
  as_phone_number(profile_id = '/+1') {
    return profile_id.substring(3)
  },
  from_phone_number(phone_number) {
    return `/+1${phone_number}`
  },
  from_e64(e64_number) {
    return `/${e64_number}`
  }
}
