export default {
  data () {
    return {
      observed: false
    }
  },
  mounted () {
    this.intersect()
  },
  destroyed () {
    if (this.observer) this.observer.unobserve(this.$el)
  },
  methods: {
    intersect () {
      this.observer = new IntersectionObserver(this.check_intersection, {
        rootMargin: '32px 0px 0px 0px',
        threshold: 0
      })
      this.observer.observe(this.$el)
    },
    check_intersection (entries) {
      entries.forEach(async entry => {
        if (entry.isIntersecting) {
          await this.show()
          this.observer.unobserve(this.$el)
        }
      })
    }
  }
}
