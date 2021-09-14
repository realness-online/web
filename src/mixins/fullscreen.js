export default {
  data () {
    return {
      fullscreen: false
    }
  },
  methods: {
    go_big () {
      this.fullscreen = !this.fullscreen
      try {
        this.$el.requestFullscreen()
      } catch (e) {
        this.$el.webkitRequestFullScreen()
      }
    }
  }
}
