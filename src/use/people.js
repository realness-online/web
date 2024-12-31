import { list, load } from '@/use/itemid'
import { current_user, me, directory } from '@/use/serverless'
import { recent_visit_first } from '@/use/sorting'
import { Me } from '@/persistance/Storage'
import { ref, computed, readonly, nextTick as next_tick } from 'vue'

export const default_person = {
  id: localStorage.me,
  type: 'person'
}
const relations = ref(undefined)

export const use = () => {
  const phonebook = ref([])
  const working = ref(true)
  const people = ref([])
  const person = computed(() => people.value[0])
  const load_person = async person => {
    const loaded = await load(person.id)
    people.value.push(loaded)
  }
  const load_people = async ids => await Promise.all(ids.map(load_person))
  const load_phonebook = async () => {
    if (current_user.value) {
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
  list(`${localStorage.me}/relations`).then(list => {
    relations.value = list
  })
  const save = async () => {
    if (me.value) {
      await next_tick()
      await new Me().save()
    }
  }
  const is_valid_name = computed(async () => {
    await next_tick()
    if (!current_user.value) return false
    let length = 0
    if (!me.value) return false

    if (me.value.first_name) length = me.value.first_name.length
    else return false // first name is required

    if (me.value.last_name) length += me.value.last_name.length
    else return false // last name is required

    if (length > 2) return true
    else return false // full name is at least 3 characters
  })

  return {
    is_valid_name,
    relations,
    save,
    me: readonly(me)
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
export const is_person = maybe => {
  if (typeof maybe !== 'object') return false
  if (maybe.type !== 'person') return false
  if (!maybe.id) return false
  return true
}
