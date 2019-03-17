<template lang="html">
  <section id="account" v-bind:class="{signed_in}" class="page left">
    <header>
      <a @click="open_camera">
        <icon name="add"></icon>
      </a>
      <icon v-if="working" name="working"></icon>
      <profile-as-figure v-else :person="person" :just_display_avatar="true" ></profile-as-figure>
      <a @click="accept_changes">
        <icon  name="finished"></icon>
      </a>
    </header>
    <input type="file" accept="image/jpeg" capture ref="avatar_upload" v-avatar_generator>
    <fieldset v-if="signed_in">
      <label for="poster">Upload Poster</label>
      <input type="file" id="poster" accept="image/jpeg" v-avatar_generator>
    </fieldset>
    <profile-as-form :person='person'></profile-as-form>
  </section>
</template>
<script>
  import Vue from 'vue'
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import { person_storage } from '@/modules/Storage'
  import as_figure from '@/components/profile/as-figure'
  import as_form from '@/components/profile/as-form'
  import icon from '@/components/icon'
  import convert_to_avatar from '@/modules/ConvertToAvatar'
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
          this.person.mobile = user.phoneNumber.substring(2)
          this.signed_in = true
        } else {
          this.signed_in = false
        }
      })
      this.$bus.$off('save-me')
      this.$bus.$on('save-me', person => {
        console.log('save-me called')
        firebase.auth().onAuthStateChanged(user => {
          if (user) {
            this.person.mobile = user.phoneNumber.substring(2)
          }
          Vue.nextTick(() => person_storage.save())
        })
      })
      this.$bus.on
    },
    methods: {
      open_camera(event) {
        this.$refs.avatar_upload.click()
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
      vectorize_avatar(image) {
        this.avatar_changed = true
        this.working = true
        const identifier = `avatar_1${vnode.context.person.mobile}`
        convert_to_avatar.trace(avatar_image, identifier).then(avatar => {
          this.working = false
          this.person.avatar = avatar
        })
      }
    },
    directives: {
      avatar_generator: {
        bind(input, binding, vnode) {
          input.addEventListener('change', event => {
            const avatar_image = event.target.files[0]
            if (avatar_image !== undefined && avatar_image.type === 'image/jpeg') {
              vnode.context.vectorize_avatar(avatar_image)
            }
          })
        }
      }
    }
  }
</script>
<style lang='stylus'>
  @require '../style/variables'
  section#account
    input[type=file]
      display: none
    & > header
      margin-bottom: base-line
      a:first-of-type
        display:none
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
      margin-bottom: base-line
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
          margin-top: (base-line * 3)
          height:66vh
          width:100vw
    & > fieldset
      width: max-content
      margin-bottom: base-line
      border-radius: base-line
      @media (min-width: max-screen)
        display: none
    form#profile-form
      #name
      #phone
        display:none
</style>
