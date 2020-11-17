export default {
  data () {
    return {
      observer: null
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
        rootMargin: '20px',
        delay: 50
      })
      this.observer.observe(this.$el)
    },
    check_intersection (entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (this.observer) this.observer.unobserve(this.$el)
          this.show()
        }
      })
    }
  }
}
