export default {
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
    },
    ratio () {
      if (!this.vector) return 1.33
      const numbers = this.vector.viewbox.split(' ')
      const width = parseInt(numbers[2])
      const height = parseInt(numbers[3])
      return (height / width)
    }
  },
  computed: {
    aspect_ratio () {
      if (this.ratio() < 1.1) {
        if (this.menu) return 'xMidYMid slice'
        else return 'xMidYMid meet'
      } else {
        if (this.menu) return 'xMidYMid meet'
        else return 'xMidYMid slice'
      }
    }
  }
}
