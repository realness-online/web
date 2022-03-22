// <input type="file" accept="image/jpeg" capture="user" ref="uploader" v-uploader>
import { ref } from 'vue'
export const vUploader = () => {
  mounted: input => input.addEventListener('change', upload)
}
export const upload = event => {
  const image = event.target.files[0]
  if (image === undefined) return
  const is_image = ['image/jpeg', 'image/png'].some(type => {
    return image.type === type
  })
  if (is_image) {
    binding.instance.vectorize(image)
    input.value = ''
  }
}
export const use = () => {
  const uploader = ref(null)
  const select_photo = () => {
    uploader.value.removeAttribute('capture')
    uploader.value.click()
  }
  const open_selfie_camera = () => {
    uploader.value.setAttribute('capture', 'user')
    uploader.value.click()
  }
  const open_camera = () => {
    uploader.value.setAttribute('capture', 'environment')
    uploader.value.click()
  }
  return {
    vUploader,
    uploader,
    select_photo,
    open_selfie_camera,
    open_camera
  }
}
