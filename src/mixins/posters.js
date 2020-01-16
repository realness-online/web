export default {
  methods: {
    prepare_posters(posters, person) {
      const meta = []
      console.log(posters);
      if (!posters.items) return meta
      posters.items.forEach(poster => {
        const created_at = Number(poster.name.split('.')[0])
        const poster_meta = {
          type: 'posters',
          created_at: new Date(created_at).toISOString(),
          id: `posters/${created_at}`,
          person
        }
        meta.push(poster_meta)
      })
      return meta
    }
  }
}
