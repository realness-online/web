import * as firebase from 'firebase/app'
import Item from '@/modules/Item'
import Storage from '@/modules/Storage'
import 'firebase/storage'

function get_url(mobile, type) {
  const path = `/people/+1${mobile}/${type}.html`
  return firebase.storage().ref().child(path).getDownloadURL()
}
export default {
  computed: {
    item_id() {
      return `/+1${this.person.mobile}`
    }
  },
  methods: {
    get_items_from_mobile(mobile, type) {
      return new Promise((resolve, reject) => {
        get_url(mobile, type).then((url) => {
          fetch(url).then(response => {
            response.text().then((server_text) => {
              const server_as_fragment = Storage.hydrate(server_text)
              resolve(Item.get_items(server_as_fragment))
            })
          })
        })
      })
    }
  }
}
