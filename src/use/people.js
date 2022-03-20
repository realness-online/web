import { ref, computed } from 'vue'
import { load, list } from '@/use/itemid'
export const use = () => {
  const people = ref([])
  const relations = ref(null)
  const person = computed(() => people.value[0])
  const load_person = async id => people.value.push(await load(id))
  const load_people = async ids => await Promise.all(ids.map(load_person))
  const load_relations = async id =>
    (relations.value = await list(`${id}/relations`))
  return {
    load_person,
    load_people,
    people,
    person,
    load_relations,
    relations
  }
}
