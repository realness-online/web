import { list, load } from '@/use/itemid'
import { current_user, directory } from '@/use/serverless'
import { recent_visit_first } from '@/use/sorting'
import {
  ref,
  computed,
  watchEffect as watch_effect,
  onMounted as mounted
} from 'vue'

const me = ref(null)
const relations = ref(null)
const phonebook = ref([]) // phone book is expensive so just load it once per session
watch_effect(async () => {
  if (current_user.value) {
    me.value = await load(from_e64(current_user.value.phoneNumber)) // load after I know about current_user
  } else if (!me.value) me.value = await load(localStorage.me) // load signed out users with a profile
})
export const use = () => {
  const working = ref(true)
  const people = ref([])
  const person = computed(() => people.value[0])
  const load_person = async person => {
    const loaded = await load(person.id)
    people.value.push(loaded)
  }
  const load_people = async ids => await Promise.all(ids.map(load_person))
  const load_phonebook = async () => {
    if (current_user.value && !phonebook.value.length) {
      console.log('load_phonebook')
      const people = await directory('/people/')
      await Promise.all(
        people.prefixes.map(async phone_number => {
          const person = await load(from_e64(phone_number.name))
          if (person) phonebook.value.push(person)
        })
      )
      phonebook.value.sort(recent_visit_first)
      working.value = false
    }
  }
  return {
    load_person,
    load_people,
    people,
    person,
    load_phonebook,
    phonebook
  }
}
export const use_me = () => {
  mounted(async () => {
    if (!relations.value)
      relations.value = await list(`${localStorage.me}/relations`)
  })
  return {
    relations,
    me
  }
}
export const get_my_itemid = type => {
  if (type) return `${localStorage.me}/${type}`
  else return localStorage.me
}
export const as_phone_number = (id = '/+1') => {
  return id.substring(2)
}
export const from_e64 = e64_number => {
  return `/${e64_number}`
}
