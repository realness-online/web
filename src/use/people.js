/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */
/** @typedef {import('@/types').Person} Person */
/** @typedef {import('@/types').Relation} Relation */
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
const relations = ref(/** @type {Relation[]} */ ([]))
const blocked = ref(/** @type {Id[]} */ ([]))

const blocked_key = () => `${localStorage.me}/blocked`
export const load_blocked = () => {
  if (!localStorage.me) return
  try {
    blocked.value = JSON.parse(localStorage.getItem(blocked_key()) || '[]')
  } catch {
    blocked.value = []
  }
}

/**
 * @returns {Id | null}
 */
const admin_person_id_from_env = () => {
  const raw = import.meta.env.VITE_ADMIN_ID
  if (!raw) return null
  return /** @type {Id} */ (`/${String(raw).replace(/^\/?/, '')}`)
}

/**
 * When `people/{author}/index.html.gz` is missing but the prefix exists, still list them.
 * @param {Id} id
 * @returns {Person}
 */
const person_when_root_profile_missing = id => ({
  id,
  type: 'person',
  name: id.startsWith('/') ? id.slice(1) : String(id)
})

export const use = () => {
  const set_working = inject('set_working')
  const phonebook = ref(/** @type {Person[]} */ ([]))
  const working = ref(true)
  const people = ref(/** @type {Item[]} */ ([]))
  const person = computed(() => people.value[0])

  /**
   * @param {Item} person
   * adds person to people
   */
  const load_person = async person => {
    const item = await load(person.id)
    if (item) people.value.push(item)
  }

  /**
   * @param {Id[]} ids
   */
  const load_people = ids =>
    Promise.all(ids.map(id => load_person(/** @type {Item} */ ({ id }))))

  const load_phonebook = async () => {
    try {
      working.value = true
      if (set_working) set_working(true)
      phonebook.value = []
      load_blocked()

      if (current_user.value) {
        const people_list = await directory('people/')
        const prefix_refs = people_list?.prefixes ?? []

        if (!prefix_refs.length) return

        const per_prefix = await Promise.all(
          prefix_refs.map(async phone_number => {
            const id = /** @type {Id} */ (from_e64(phone_number.name))
            try {
              const loaded = await load(id)
              const person = loaded || person_when_root_profile_missing(id)
              return {
                prefix: phone_number.name,
                id,
                person,
                load_ok: !!loaded,
                error: null
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err)
              console.error('[phonebook] load threw', phone_number.name, msg)
              return {
                prefix: phone_number.name,
                id,
                person: null,
                load_ok: false,
                error: msg
              }
            }
          })
        )

        const loaded_people = per_prefix.map(p => p.person)
        const blocked_ids = new Set(blocked.value)
        const seen = new Set()

        phonebook.value = /** @type {Person[]} */ (
          loaded_people
            .map(person => ({ person }))
            .filter(({ person }) => {
              if (!person) return false
              if (blocked_ids.has(person.id)) return false
              if (seen.has(person.id)) return false
              seen.add(person.id)
              return true
            })
            .map(({ person }) => /** @type {Person} */ (person))
        )
      } else {
        const admin_id = admin_person_id_from_env()
        if (admin_id) {
          const person = await load(admin_id)
          if (person && is_person(person)) phonebook.value = [person]
        }
      }

      phonebook.value.sort(recent_visit_first)
    } catch (err) {
      console.error(
        '[phonebook] Failed to load phonebook:',
        err instanceof Error ? err.message : String(err)
      )
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
    list(/** @type {Id} */ (`${localStorage.me}/relations`)).then(items => {
      relations.value = /** @type {Relation[]} */ (items)
    })
    load_blocked()
  }

  const block_person = /** @param {Id} person_id */ person_id => {
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
    const me_el = document.querySelector(`[itemid="${localStorage.me}"]`)
    if (me_el) await new Me().save(me_el)
  }
  const is_valid_name = computed(() => {
    if (!current_user.value) return false
    const me_val = me.value
    if (!me_val?.name) return false
    if (me_val.name.length < 3) return false
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
  return localStorage.me ?? null
}
export const as_phone_number = (id = '/+1') => id.substring(2)
export const from_e64 = e64_number => `/${e64_number}`
/**
 * @param {unknown} maybe
 * @returns {maybe is Person}
 */
export const is_person = maybe => {
  if (typeof maybe !== 'object' || maybe === null) return false
  const candidate = /** @type {{ type?: unknown; id?: unknown }} */ (maybe)
  if (candidate.type !== 'person') return false
  if (!candidate.id) return false
  return true
}
