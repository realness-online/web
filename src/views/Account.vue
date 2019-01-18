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
    <profile-as-form :person='person'></profile-as-form>
    <input type="file" accept="image/jpeg" capture ref="file_upload" v-uploader>
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
        avatar_changed: false
      }
    },
    methods: {
      open_camera(event) {
        // this.working = true
        this.$refs.file_upload.click()
      },
      accept_changes(event) {
        console.log('accept changes')
        this.working = true
        const route = {
          path: `/profile`
        }
        if (this.avatar_changed) {
          person_storage.save().then(() => {
            this.working = false
            this.$router.push(route)
          })
        } else {
          this.$router.push(route)
        }
      }
    },
    directives: {
      uploader: {
        bind(input, binding, vnode) {
          input.addEventListener('change', event => {
            console.log('change', event)
            const avatar_image = event.target.files[0]
            /* istanbul ignore next */
            if (avatar_image !== undefined) {
              vnode.context.avatar_changed = true
              vnode.context.working = true
              if (avatar_image.type === 'image/jpeg') {
                const identifier = `avatar_1${vnode.context.person.mobile}`
                convert_to_avatar.trace(avatar_image, identifier).then(avatar => {
                  vnode.context.working = false
                  vnode.context.person.avatar = avatar
                })
              }
            }
          })
        }
      }
    },
    created() {
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
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          console.log('signed in')
          this.person.mobile = user.phoneNumber.substring(2)
          this.signed_in = true
        } else {
          this.signed_in = false
        }
      })
    }
  }
</script>
<style lang='stylus'>
  @require '../style/variables'
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
          margin-top: (base-line * 2)
          // animation-name: slideInDown
          border-radius: 100vw
          height:66vh
          width:100vw
    form#profile-form
      #name
      #phone
        display:none
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
</style>
