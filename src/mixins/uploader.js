// <input type="file" accept="image/jpeg" capture="user" ref="uploader" v-uploader>
export default {
  methods: {
    select_photo() {
      this.$refs.uploader.removeAttribute('capture')
      this.$refs.uploader.click()
    },
    open_selfie_camera() {
      this.$refs.uploader.setAttribute('capture', 'user')
      this.$refs.uploader.click()
    },
    open_camera() {
      this.$refs.uploader.setAttribute('capture', 'environment')
      this.$refs.uploader.click()
    }
  },
  directives: {
    uploader: {
      mounted(input, binding) {
        /* istanbul ignore next */
        input.addEventListener('change', event => {
          const image = event.target.files[0]
          if (image === undefined) return
          const is_image = ['image/jpeg', 'image/png'].some(type => {
            return image.type === type
          })
          if (is_image) {
            console.log(binding.instance, image)
            binding.instance.vectorize(image)
            input.value = ''
          }
        })
      }
    }
  }
}
