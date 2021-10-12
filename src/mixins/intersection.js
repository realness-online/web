export default {
  data () {
    return {
      observer: new IntersectionObserver(this.check_intersection, {
        rootMargin: '32px 0px 0px 0px',
        threshold: 0
      })
    }
  },
  mounted () {
    this.observer.observe(this.$el)
  },
  beforeUnmount () {
    this.observer.unobserve(this.$el)
  },
  methods: {
    check_intersection (entries) {
      const entry = entries[0]
      if (entry.isIntersecting) {
        this.show()
        this.observer.unobserve(this.$el)
      }
    }
  }
}
