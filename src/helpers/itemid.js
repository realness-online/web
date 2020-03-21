import Item from '@/modules/item'
import * as firebase from 'firebase/app'
import 'firebase/storage'
async function get_download_url(itemid) {
  const path = `/people${itemid}.html`
  try {
    return await firebase.storage().ref().child(path).getDownloadURL()
  } catch (e) {
    if (e.code === 'storage/object-not-found') {
      console.warn(path)
      return null
    } else throw e
  }
}
export default {
  async load(itemid) {
    const url = await get_download_url(itemid)
    if (url) {
      const server_text = await (await fetch(url)).text()
      return Item.get_first_item(server_text)
    } else return null
  },
  as_query_id(itemid = '/+') {
    return itemid.substring(2)
  },
  as_fragment(itemid) {
    return `#${this.as_query_id(itemid)}`
  }
}
