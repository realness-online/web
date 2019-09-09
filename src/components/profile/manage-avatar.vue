<template lang="html">
  <div id="manage-avatar">
    <icon v-if="working" name="working"></icon>
    <as-avatar v-else :person="person" :by_reference="true"></as-avatar>
    <menu v-if="signed_in">
      <a @click="open_camera"><icon name="camera"></icon></a>
      <a id="select_photo" @click="select_photo"><icon name="add"></icon></a>
      <a @click="accept_changes" v-if="avatar_changed"><icon name="finished"></icon></a>
      <a id="download-avatar" :href="downloadable" download='vector.svg'><icon name="download"></icon></a>
    </menu>
    <input type="file" accept="image/jpeg" capture ref="uploader" v-uploader>
  </div>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import convert_to_avatar from '@/modules/convert_to_avatar'
  import { person_local } from '@/modules/LocalStorage'
  import profile_id from '@/helpers/profile'
  import icon from '@/components/icon'
  import as_avatar from '@/components/profile/as-avatar'
  export default {
    components: {
      icon,
      'as-avatar': as_avatar
    },
    props: {
      person: Object
    },
    data() {
      return {
        working: false,
        avatar_changed: false,
        signed_in: false
      }
    },
    created() {
      firebase.auth().onAuthStateChanged(user => {
        if (user) this.signed_in = true
      })
    },
    computed: {
      downloadable() {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
          ${this.person.avatar}
          <use href="${profile_id.as_avatar_fragment(this.person.id)}"/>
        </svg>`
        return `data:application/octet-stream,${encodeURIComponent(svg)}`
      }
    },
    methods: {
      async vectorize_image(image) {
        this.working = true
        this.avatar_changed = true
        const avatar_id = profile_id.as_avatar_id(this.person.id)
        await this.$nextTick()
        const avatar = await convert_to_avatar.trace(image, avatar_id)
        this.$emit('new-avatar', avatar)
        this.working = false
      },
      async accept_changes(event) {
        await person_local.save()
        this.avatar_changed = false
      },
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
</script>
<style lang="stylus">
  div#manage-avatar
    position: relative
    margin-top: -(base-line * 4)
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
        &#select_photo
          @media (min-width: max-screen)
            display: none
        &#download-avatar
          display: none
          @media (min-width: max-screen)
            display: inherit
        & > svg
          fill: red
          &.camera
            height: (base-line * 3)
            width: (base-line * 2.33)
    & > input[type=file]
      display: none
</style>
