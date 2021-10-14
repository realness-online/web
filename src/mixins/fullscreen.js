export default {
  data () {
    return {
      is_fullscreen: false
    }
  },
  methods: {
    fullscreen () {
      this.is_fullscreen = !this.is_fullscreen
      try {
        this.$el.requestFullscreen()
      } catch (e) {
        this.$el.webkitRequestFullScreen()
      }
    }
  }
}
