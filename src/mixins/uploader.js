// <input type="file" accept="image/jpeg" capture ref="uploader" v-uploader>
export default {
  methods: {
    select_photo(event) {
      this.$refs.uploader.removeAttribute('capture')
      this.$refs.uploader.click()
    },
    open_camera(event) {
      this.$refs.uploader.setAttribute('capture', true)
      this.$refs.uploader.click()
    }
  },
  directives: {
    uploader: {
      bind(input, binding, vnode) {
        input.addEventListener('change', event => {
          const image = event.target.files[0]
          if (image !== undefined && image.type === 'image/jpeg') {
            vnode.context.vectorize_image(image)
          }
        })
      }
    }
  }
}
