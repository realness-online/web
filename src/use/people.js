/** @typedef {import('@/types').Id} Id */

import { list, load } from '@/utils/itemid'
import { current_user, me, directory } from '@/utils/serverless'
import { recent_visit_first } from '@/utils/sorting'
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

  /**
   * @param {Item} person
   * adds person to people
   */
  const load_person = async person => {
    const item = await load(person.id)
    people.value.push(item)
  }

  /**
   * @param {Id[]} ids
   */
  const load_people = ids => Promise.all(ids.map(load_person))

  const load_phonebook = async () => {
    if (!current_user.value) return

    try {
      working.value = true
      // Clear existing entries
      phonebook.value = []

      const people = await directory('/people/')
      if (!people?.prefixes?.length) {
        working.value = false
        return
      }

      const loaded_people = await Promise.all(
        people.prefixes.map(async phone_number => {
          try {
            const person = await load(from_e64(phone_number.name))
            return person || null
          } catch (err) {
            console.error('Failed to load person:', phone_number.name, err)
            return null
          }
        })
      )

      // Filter out nulls and add unique entries
      phonebook.value = loaded_people.filter(
        person => person && !phonebook.value.some(p => p.id === person.id)
      )

      // Re-enable sorting
      phonebook.value.sort(recent_visit_first)
    } catch (err) {
      console.error('Failed to load phonebook:', err)
    } finally {
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
  const save = () => me.value?.save()
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
    return false // full name is at least 3 characters
  })

  return {
    is_valid_name,
    relations,
    save,
    me
  }
}
export const get_my_itemid = type => {
  if (type) return `${localStorage.me}/${type}`
  return localStorage.me
}
export const as_phone_number = (id = '/+1') => id.substring(2)
export const from_e64 = e64_number => `/${e64_number}`
export const is_person = maybe => {
  if (typeof maybe !== 'object') return false
  if (maybe.type !== 'person') return false
  if (!maybe.id) return false
  return true
}
