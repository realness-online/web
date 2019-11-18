import Item from '@/modules/item'
import Storage from '@/classes/Storage'
export default {
  async load(id) {
    const people = await this.items(id, 'person')
    if (people.length > 1) {
      const person = people[0]
      person.id = id
      return person
    }
    else return { id }
  },
  async items(id, name) {
    console.log(name, id)
    const url = await Storage.get_download_url(id, `${name}.html`)
    const server_text = await (await fetch(url)).text()
    return Item.get_items(Storage.hydrate(server_text))
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
