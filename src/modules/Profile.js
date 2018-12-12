import * as firebase from 'firebase/app'
import Item from '@/modules/Item'
import Storage from '@/modules/Storage'
import 'firebase/storage'
function get_url(mobile, type) {
  const path = `/people${mobile}/${type}.html`
  return firebase.storage().ref().child(path).getDownloadURL()
}
export default {
  load(phone_number) {
    // console.log(phone_number)
    return new Promise((resolve, reject) => {
      this.items(phone_number, 'person').then(items => {
        resolve(items[0])
      })
    })
  },
  items(mobile, type) {
    return new Promise((resolve, reject) => {
      get_url(mobile, type).then((url) => {
        fetch(url).then(response => {
          response.text().then((server_text) => {
            const server_as_fragment = Storage.hydrate(server_text)
            let items = Item.get_items(server_as_fragment)
            resolve(items)
          })
        })
      })
    })
  }
}
