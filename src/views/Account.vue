<template lang="html">
  <section id="account" v-bind:class="{signed_in}" class="page">
    <header>
      <a @click="open_camera"><icon name="add"></icon></a>
      <icon v-if="working" name="working"></icon>
      <profile-as-figure v-else :person="person" :just_display_avatar="true" ></profile-as-figure>
      <a @click="accept_changes"><icon  name="finished"></icon></a>
    </header>
    <div>
      <input type="file" accept="image/jpeg" capture ref="uploader" v-uploader>
      <a v-if="signed_in" :href="downloadable" download='vector.svg'>Download</a>
      <button v-if="signed_in" @click="attach_poster">Poster</button>
      <profile-as-form :person='person'></profile-as-form>
    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import { person_storage } from '@/modules/Storage'
  import profile_id from '@/modules/profile_id'
  import as_figure from '@/components/profile/as-figure'
  import as_form from '@/components/profile/as-form'
  import icon from '@/components/icon'
  import convert_to_avatar from '@/modules/convert_to_avatar'
  export default {
    components: {
      'profile-as-figure': as_figure,
      'profile-as-form': as_form,
      icon
    },
    data() {
      return {
        working: false,
        person: person_storage.as_object(),
        signed_in: false,
        avatar_changed: false,
        image_file: null
      }
    },
    created() {
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          this.person.id = profile_id.from_e64(user.phoneNumber)
          this.signed_in = true
          profile_id.load(this.person.id).then(profile => {
            this.person = profile
          })
        } else {
          this.signed_in = false
        }
      })
      this.$bus.$off('save-me')
      this.$bus.$on('save-me', person => {
        console.log('save-me called')
        firebase.auth().onAuthStateChanged(user => {
          if (user) {
            this.person.id = profile_id.from_e64(user.phoneNumber)
          }
          Vue.nextTick(() => person_storage.save())
        })
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
      open_camera(event) {
        this.$refs.uploader.setAttribute('capture', true)
        this.$refs.uploader.click()
      },
      accept_changes(event) {
        const route = {
          path: `/profile`
        }
        if (this.avatar_changed) {
          person_storage.save().then(() => {
            this.$router.push(route)
          })
        } else {
          this.$router.push(route)
        }
      },
      vectorize_image(image) {
        this.avatar_changed = true
        this.working = true
        console.log(this.person)
        convert_to_avatar.trace(image, profile_id.as_avatar_id(this.person.id))
        .then(avatar => {
          this.working = false
          this.person.avatar = avatar
        })
      },
      attach_poster(event) {
        console.log('find me a poster')
        this.$refs.uploader.removeAttribute('capture')
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
<style lang='stylus'>
  section#account
    max-width: page-width
    input[type=file]
      display: none
    & > header
      & > a:first-of-type
        display:none
    & > div
      padding: 0 base-line base-line base-line
    & > button
      display: block
    & > footer > menu
      padding: base-line
      display: flex
      justify-content: space-evenly
      align-items: flex-end
      button
        border: none
        padding: 0
        margin:0
        &[disabled]
          opacity:0.5
  section#account.signed_in
    position: relative
    svg.working
      flex-grow: 1
      padding: base-line
      padding-top: (base-line * 6)
      width:100vw
      height:50vh
    & > header
      min-height:100vh
      & > a
        position: absolute
        -webkit-tap-highlight-color: black
        z-index: 2
        &:first-child
          display: inherit
          left: base-line
        &:nth-child(3)
          right: base-line
      & > figure
        & > figcaption
          display: none
        & > svg
          -webkit-tap-highlight-color: transparent
          // margin-top: (base-line * 3)
          min-height:100vh
          width:100vw
    & > div
      display: flex
      flex-direction: column
      align-items: center
      & > a
        margin-bottom: base-line
        standard-button: black
        display:inline-block
      & > button
        margin-bottom: base-line
      & > form
        #name
        #phone
          display:none
</style>
