export default {
  data () {
    return {
      observer: null,
      options: {
        rootMargin: '0px 0px 256px 0px'
      }
    }
  },
  async updated () {
    if (this.i_am_oldest) {
      this.observer = new IntersectionObserver(this.end_of_articles, this.options)
      await this.$nextTick()
      this.observer.observe(this.$el)
    }
  },
  destroyed () {
    if (this.observer) this.observer.unobserve(this.$el)
  },
  methods: {
    end_of_articles (entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.$emit('end-of-articles', this.person)
          if (this.observer) this.observer.unobserve(this.$el)
        }
      })
    }
  }
}
