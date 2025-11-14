import { defineComponent } from 'vue'

export default defineComponent({
  name: 'VectorMock',
  template: '<div></div>',
  data() {
    return {
      observer: null
    }
  },
  methods: {
    check_intersection(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.show()
        }
      })
    },
    show() {
      // Mock show method
    },
    unmount() {
      if (this.observer) {
        this.observer.unobserve()
      }
    }
  }
})
