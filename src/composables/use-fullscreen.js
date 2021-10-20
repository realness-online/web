import { ref } from 'vue'

export default function use_fullscreen () {
  console.log('use_fullscreen')
  const is_fullscreen = ref(false)
  is_fullscreen.value = !is_fullscreen.value

  try {
    this.$el.requestFullscreen()
  } catch (e) {
    this.$el.webkitRequestFullScreen()
  }

  return {
    is_fullscreen
  }
}
