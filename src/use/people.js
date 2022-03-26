import { ref, computed } from 'vue'
import { list, load } from '@/use/itemid'
import { from_e64 } from '@/use/profile'
import { current_user, directory } from '@/use/serverless'
import { recent_visit_first } from '@/use/sorting'
export const phonebook = ref([])
const load_phonebook = async () => {
  if (current_user.value && !phonebook.value.length) {
    const people = await directory('/people/')
    await Promise.all(
      people.prefixes.map(async phone_number => {
        const person = await load(from_e64(phone_number.name))
        if (person) phonebook.value.push(person)
      })
    )
    phonebook.value.sort(recent_visit_first)
  }
}

export const use = () => {
  const people = ref([])
  const relations = ref(null)
  const person = computed(() => people.value[0])
  const load_person = async person => people.value.push(person)
  const load_people = async ids => await Promise.all(ids.map(load_person))
  const load_relations = async person =>
    (relations.value = await list(`${person.id}/relations`))
  return {
    load_person,
    load_people,
    people,
    person,
    load_relations,
    relations,
    load_phonebook,
    phonebook
  }
}
