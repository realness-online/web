<template lang="html">
  <div id="manage-avatar">
    <icon v-if="working" name="working"></icon>
    <as-avatar v-else :person="person" :by_reference="true"></as-avatar>
    <menu v-if="signed_in">
      <a id="open_camera" @click="open_camera"><icon name="camera"></icon></a>
      <a id="accept_changes" @click="accept_changes" v-if="avatar_changed"><icon name="finished"></icon></a>
      <a id="select_photo" @click="select_photo"><icon name="add"></icon></a>
    </menu>
    <input type="file" accept="image/jpeg" capture ref="uploader" v-uploader>
  </div>
</template>
<script>
  import { person_local } from '@/modules/LocalStorage'
  import profile_id from '@/helpers/profile'
  import icon from '@/components/icon'
  import as_avatar from '@/components/profile/as-avatar'
  import signed_in from '@/mixins/signed_in'
  import uploader from '@/mixins/uploader'
  export default {
    mixins: [signed_in, uploader],
    components: {
      icon,
      'as-avatar': as_avatar
    },
    props: {
      person: Object
    },
    data() {
      return {
        worker: new Worker('/vector.worker.js'),
        working: false,
        avatar_changed: false
      }
    },
    computed: {
      // <a id="download-avatar" :href="downloadable" download='vector.svg'><icon name="download"></icon></a>
      downloadable() {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
          ${this.person.avatar}
          <use href="${profile_id.as_avatar_fragment(this.person.id)}"/>
        </svg>`
        return `data:application/octet-stream,${encodeURIComponent(svg)}`
      }
    },
    created() {
      this.worker.addEventListener('message', this.worker_event)
    },
    methods: {
      worker_event(message) {
        this.avatar_changed = true
        this.$emit('new-avatar', message.data.image)
        this.working = false
      },
      vectorize_image(image) {
        this.working = true
        this.worker.postMessage({ image, width: 322 })
      },
      async accept_changes(event) {
        await person_local.save()
        this.avatar_changed = false
      }
    }
  }
</script>
<style lang="stylus">
  div#manage-avatar
    position: relative
    & > svg
      fill: white
      width: 100vw
      min-height: 100vh
      &.working
        flex-grow: 1
        padding: base-line
        width: 30vw
        height: 15vh
    & > menu
      position: relative
      z-index: 1
      display: flex
      justify-content: space-between
      margin-top: -(base-line * 3)
      padding: 0 base-line base-line base-line
      & > a
        cursor: pointer
        & > svg
          fill: red
          &.camera
            height: (base-line * 3)
            width: (base-line * 2.33)
        &#accept_changes > svg
          fill: yellow
    & > input[type=file]
      display: none
</style>
