<template lang="html">
  <section id="account" v-bind:class="{signed_in}" class="page">
    <header>
      <a v-if="signed_in" @click="open_camera"><icon name="add"></icon></a>
      <profile-as-figure :person="person"></profile-as-figure>
      <a v-if="avatar_changed" @click="revert_avatar" ><icon name="remove"></icon></a>
      <a @click="accept_changes"><icon name="finished"></icon></a>
    </header>
    <icon v-if="working" name="working"></icon>
    <as-avatar v-if="signed_in" :person="person"></as-avatar>
    <div>
      <input type="file" accept="image/jpeg" capture ref="uploader" v-uploader>
      <a v-if="signed_in" :href="downloadable" download='vector.svg'>Download Avatar</a>
      <button v-if="signed_in" @click="attach_poster">Upload Event Poster</button>
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
  import asAvatar from '@/components/profile/as-avatar'
  import icon from '@/components/icon'
  import convert_to_avatar from '@/modules/convert_to_avatar'
  export default {
    components: {
      'profile-as-figure': as_figure,
      'profile-as-form': as_form,
      icon,
      asAvatar
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
      revert_avatar(event) {
        console.log('holy shit this is not implemented!')
      },
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
    & > header
      max-width: page-width
      margin: auto
    & > svg
      fill: white
      width:100vw
      min-height:100vh
      &.working
        flex-grow: 1
        padding: base-line
        width:100vw
        height:50vh
    & > div
      margin: auto
      max-width: page-width
      display: flex
      flex-direction: column
      align-items: center
      padding: base-line
      & > input[type=file]
        display: none
      & > a
        margin-bottom: base-line
        standard-button: black
      & > button
        margin-bottom: base-line
      & > form
        #name
        #phone
          display:none
    &.signed_in > header > figure
      display: none
</style>
