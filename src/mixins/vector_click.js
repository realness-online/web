export default {
  data() {
    return {
      menu: true
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
      if (this.menu) return 'xMidYMid slice'
      else return 'xMidYMid meet'
    }
  }
}
