import firebase from 'firebase/compat/app'
import 'firebase/compat/auth'
import { load } from '@/use/itemid'
import { from_e64 } from '@/use/profile'
import { visit_interval } from '@/persistance/Cloud.sync'
export default {
  created() {
    this.update_visit()
  },
  emits: ['update:person'],
  methods: {
    update_visit() {
      firebase.auth().onAuthStateChanged(async user => {
        if (navigator.onLine && user) {
          const person = await load(from_e64(user.phoneNumber))
          if (!person) return // Do nothing until there is a person
          const visit_digit = new Date(person.visited).getTime()
          if (visit_interval() > visit_digit) {
            const new_visit = new Date().toISOString()
            person.visited = new_visit
            this.$emit('update:person', person)
          }
        }
      })
    }
  }
}
