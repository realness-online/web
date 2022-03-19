import { ref } from 'vue'
import { load } from '@/use/itemid'
export const use = () => {
  const people = ref([])
  const relations = ref(null)
  const load_person = async id => people.value.push(await load(id))
  const load_people = async ids => await Promise.all(ids.map(load_person))
  const load_relations = async id =>
    (relations.value = await list(`${id}/relations`))
  return {
    load_person,
    load_people,
    people,
    load_relations,
    relations
  }
}
