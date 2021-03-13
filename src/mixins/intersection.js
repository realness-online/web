export default {
  data () {
    return {
      observer: null,
      observed: false
    }
  },
  mounted () { this.intersect() },
  updated () { this.intersect() },
  destroyed () {
    if (this.observer) this.observer.unobserve(this.$el)
  },
  methods: {
    intersect () {
      if (this.observer) this.observer.unobserve(this.$el)
      this.observer = new IntersectionObserver(this.check_intersection, {
        rootMargin: '32px 0 0 0',
        delay: 50,
        threshold: 0
      })
      this.observer.observe(this.$el)
    },
    check_intersection (entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (this.observer) this.observer.unobserve(this.$el)
          if (!this.observed) {
            this.observed = true
            this.show()
          }
        }
      })
    }
  }
}
