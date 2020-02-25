export default {
  data() {
    return {
      observer: null
    }
  },
  async mounted() { this.intersect() },
  async updated() { this.intersect() },
  destroyed() {
    if (this.observer) this.observer.unobserve(this.$el)
  },
  methods: {
    async intersect() {
      if (this.observer) this.observer.unobserve(this.$el)
      this.observer = new IntersectionObserver(entries => {
        entries.forEach(async entry => {
          if (entry.isIntersecting) {
            console.log('calling show()')
            this.show()
          }
        })
      })
      await this.$nextTick()
      this.observer.observe(this.$el)
    },
  }
}
