export const use = () => {
  const posters = ref([])

  const for_person = async person => {
    const [post, avatars] = await Promise.all([
      as_directory(`${person.id}/posters`),
      as_directory(`${person.id}/avatars`)
    ])
    const combined = [...post.items, ...avatars.items]
    if (combined.length) {
      combined.forEach(created_at => {
        posters.push({
          id: `${person.id}/posters/${created_at}`,
          type: 'posters'
        })
      })
    }
  }
  const for_people = async people => {
    await Promise.all(people.map(load_posters_for_person))
  }
  return {
    for_person,
    for_people,
    posters
  }
}
