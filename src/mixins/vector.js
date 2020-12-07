export default {
  data () {
    return {
      vector: null
    }
  },
  props: {
    immediate: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  computed: {
    path () {
      if (this.working || !this.vector) return null
      if (Array.isArray(this.vector.path)) return this.vector.path.join('\n')
      else return this.vector.path
    }
  },
  created () {
    if (this.immediate) this.show()
  }
}
