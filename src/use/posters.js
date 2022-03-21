import { ref } from 'vue'
import { as_directory } from '@/use/itemid'
export const use = () => {
  const posters = ref([])
  const for_person = async person => {
    const [post, avatars] = await Promise.all([
      as_directory(`${person.id}/posters`),
      as_directory(`${person.id}/avatars`)
    ])
    post.items.forEach(created_at => {
      posters.value.push({
        id: `${person.id}/posters/${created_at}`,
        type: 'posters'
      })
    })
    avatars.items.forEach(created_at => {
      posters.value.push({
        id: `${person.id}/avatars/${created_at}`,
        type: 'avatars'
      })
    })
  }
  return {
    for_person,
    posters
  }
}
