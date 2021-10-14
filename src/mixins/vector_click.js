export default {
  props: {
    slice: {
      type: Boolean,
      required: false,
      default: true
    }
  },
  emits: ['vector-click'],
  data () {
    return {
      vector: null,
      menu: false
    }
  },
  methods: {
    vector_click () {
      this.menu = !this.menu
      this.$emit('vector-click', this.menu)
    }
  },
  computed: {
    aspect_ratio () {
      if (this.menu || !this.slice) return 'xMidYMid meet'
      else return 'xMidYMid slice'
    },
    landscape () {
      if (!this.vector) return false
      const numbers = this.vector.viewbox.split(' ')
      const width = parseInt(numbers[2])
      const height = parseInt(numbers[3])
      return width > height
    }
  }
}
