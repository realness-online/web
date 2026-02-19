/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */
import { ref, computed, inject, nextTick as tick } from 'vue'
import { list, load } from '@/utils/itemid'
import { current_user, me, directory } from '@/utils/serverless'
import { recent_visit_first } from '@/utils/sorting'
import { Me } from '@/persistance/Storage'

// Check if we're in a browser environment
const is_browser =
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'

export const default_person = {
  id: is_browser ? localStorage.me : null,
  type: 'person'
}
const relations = ref(undefined)
const blocked = ref([])

const blocked_key = () => `${localStorage.me}/blocked`
export const load_blocked = () => {
  if (!localStorage.me) return
  try {
    blocked.value = JSON.parse(localStorage.getItem(blocked_key()) || '[]')
  } catch {
    blocked.value = []
  }
}

export const use = () => {
  const set_working = inject('set_working')
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
  const load_people = ids =>
    Promise.all(ids.map(id => load_person(/** @type {Item} */ ({ id }))))

  const load_phonebook = async () => {
    if (!current_user.value) return

    try {
      working.value = true
      if (set_working) set_working(true)
      phonebook.value = []
      load_blocked()

      const people = await directory('people/')
      if (!people?.prefixes?.length) {
        working.value = false
        if (set_working) set_working(false)
        return
      }

      const loaded_people = await Promise.all(
        people.prefixes.map(async phone_number => {
          try {
            const person = await load(
              /** @type {Id} */ (from_e64(phone_number.name))
            )
            return person || null
          } catch (err) {
            console.error('Failed to load person:', phone_number.name, err)
            return null
          }
        })
      )

      // Filter out nulls, duplicates, and blocked
      const blocked_ids = new Set(blocked.value)
      phonebook.value = loaded_people.filter(
        person =>
          person &&
          !phonebook.value.some(p => p.id === person.id) &&
          !blocked_ids.has(person.id)
      )

      // Re-enable sorting
      phonebook.value.sort(recent_visit_first)
    } catch (err) {
      console.error('Failed to load phonebook:', err)
    } finally {
      working.value = false
      if (set_working) set_working(false)
    }
  }
  return {
    load_person,
    load_people,
    people,
    person,
    load_phonebook,
    phonebook,
    blocked
  }
}
export const use_me = () => {
  if (is_browser) {
    list(/** @type {Id} */ (`${localStorage.me}/relations`)).then(list => {
      relations.value = list
    })
    load_blocked()
  }

  const block_person = person_id => {
    if (!localStorage.me) return
    if (!blocked.value.includes(person_id)) {
      blocked.value = [...blocked.value, person_id]
      localStorage.setItem(blocked_key(), JSON.stringify(blocked.value))
    }
  }

  const unblock_person = person_id => {
    if (!localStorage.me) return
    blocked.value = blocked.value.filter(id => id !== person_id)
    localStorage.setItem(blocked_key(), JSON.stringify(blocked.value))
  }

  const save = async () => {
    await tick()
    await new Me().save(document.querySelector(`[itemid="${localStorage.me}"]`))
  }
  const is_valid_name = computed(() => {
    if (!current_user.value) return false
    if (!me.value) return false
    if (!me.value.name) return false
    if (me.value.name.length < 3) return false
    return true
  })

  return {
    is_valid_name,
    relations,
    save,
    me,
    blocked,
    block_person,
    unblock_person
  }
}
export const get_my_itemid = type => {
  if (!is_browser) return null
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
