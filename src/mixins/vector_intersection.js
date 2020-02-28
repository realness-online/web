export default {
  data() {
    return {
      observer: null
    }
  },
  async mounted() { this.intersect() },
  // async updated() { this.intersect() },
  destroyed() {
    if (this.observer) this.observer.unobserve(this.$el)
  },
  methods: {
    async intersect() {
      if (this.observer) this.observer.unobserve(this.$el)
      this.observer = new IntersectionObserver(this.check_intersection)
      this.observer.observe(this.$el)
    },
    check_intersection(entries) {
      entries.forEach(async entry => {
        if (entry.isIntersecting) {
          console.log('calling show()', this.$el)
          this.show()
          this.observer.unobserve(this.$el)
        }
      })
    }
  }
}
