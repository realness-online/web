export default {
  data () {
    return {
      vector: null
    }
  },
  computed: {
    path () {
      if (this.working || !this.vector) return null
      if (Array.isArray(this.vector.path)) return this.vector.path.join('\n')
      else return this.vector.path
    }
  }
}
