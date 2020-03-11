export default {
  data() {
    return {
      menu: false
    }
  },
  methods: {
    vector_click(event) {
      console.log('vector_click')
      this.menu = !this.menu
      this.$emit('vector-clicked', event)
    }
  },
  computed: {
    aspect_ratio() {
      if (this.menu) return 'xMidYMid meet'
      else return 'xMidYMid slice'
    }
  }
}
