import { ref } from 'vue'

/** @typedef {import('@/types').Id} Id */

/**
 * n4: the people who run this network, the `+realness` org, as sync lists
 * them to anyone. Read once per page load; a failed read is tried again.
 * @type {import('vue').Ref<{ name: string, phone: string, role: string }[]>}
 */
export const network = ref([])

/** @type {Promise<Id[]> | null} */
let pending = null

const as_id = phone => /** @type {Id} */ (`/${phone}`)

/** @returns {Promise<Id[]>} each network member's itemid, founder first */
export const network_ids = () => {
  pending ??= fetch('/v1/network')
    .then(response => (response.ok ? response.json() : { people: [] }))
    .then(({ people }) => {
      network.value = people
      return people.map(person => as_id(person.phone))
    })
    .catch(() => {
      pending = null
      return []
    })
  return pending
}

/** Whether an author is in the network, as last read. */
export const is_network_member = id =>
  network.value.some(person => as_id(person.phone) === id)
