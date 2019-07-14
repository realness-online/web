<template lang="html">
  <section v-if="auth_checked" id="account" v-bind:class="{signed_in}" class="page">
    <header>
      <icon name="nothing"></icon>
      <logo-as-link></logo-as-link>
    </header>
    <icon v-if="working" name="working"></icon>
    <profile-as-avatar v-if="show_avatar" :person="me"></profile-as-avatar>
    <menu v-if="show_avatar">
      <a @click="open_camera">
        <icon name="add"></icon>
      </a>
      <a @click="accept_changes" v-if="avatar_changed">
        <icon name="finished"></icon>
      </a>
      <a id="download-avatar" :href="downloadable" download='vector.svg'>
        <icon name="download"></icon>
      </a>
    </menu>
    <div id="login">
      <profile-as-figure :person="me"></profile-as-figure>
      <profile-as-form :person='me'></profile-as-form>
    </div>
    <my-posts-as-list></my-posts-as-list>
    <input type="file" accept="image/jpeg" capture ref="uploader" v-uploader>
  </section>
</template>
<script>
  import Vue from 'vue'
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import icon from '@/components/icon'
  import { person_storage } from '@/modules/Storage'
  import profile_id from '@/modules/profile_id'
  import profile_as_figure from '@/components/profile/as-figure'
  import profile_as_form from '@/components/profile/as-form'
  import profile_as_avatar from '@/components/profile/as-avatar'
  import my_posts_as_list from '@/components/posts/my-list'
  import logo_as_link from '@/components/logo-as-link'
  import convert_to_avatar from '@/modules/convert_to_avatar'
  import posts_into_days from '@/mixins/posts_into_days'
  export default {
    mixins: [posts_into_days],
    components: {
      'profile-as-figure': profile_as_figure,
      'profile-as-form': profile_as_form,
      'profile-as-avatar': profile_as_avatar,
      'my-posts-as-list': my_posts_as_list,
      'logo-as-link': logo_as_link,
      icon
    },
    data() {
      return {
        me: person_storage.as_object(),
        auth_checked: false,
        working: false,
        signed_in: false,
        avatar_changed: false,
        image_file: null
      }
    },
    created() {
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          this.signed_in = true
          const id = profile_id.from_e64(user.phoneNumber)
          profile_id.load(id).then(profile => {
            this.me = profile
            this.me.id = id
          })
        }
        this.auth_checked=true
      })
      this.$bus.$off('save-me')
      this.$bus.$on('save-me', person => {
        console.log('save-me called', person)
        firebase.auth().onAuthStateChanged(user => {
          if (user) {
            this.me.id = profile_id.from_e64(user.phoneNumber)
            if (this.me.avatar) {
              Vue.nextTick(() => person_storage.save())
            } else {
              console.log('no avatar', this.me.id)
              profile_id.load(this.me.id).then(profile => {
                this.me.avatar = profile.avatar
                console.log('profile loaded', this.me.avatar)
                Vue.nextTick(() => person_storage.save())
              }).catch(error => {
                console.log(error.message)
                Vue.nextTick(() => person_storage.save())
              })
            }
          } else {
            Vue.nextTick(() => person_storage.save())
          }
        })
      })
    },
    computed: {
      show_avatar() {
        if(this.signed_in && !this.working) {
          return true
        } else {
          return false
        }
      },
      downloadable() {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
          ${this.me.avatar}
          <use href="${profile_id.as_avatar_fragment(this.me.id)}"/>
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
        if (this.avatar_changed) {
          person_storage.save().then(() => {
            this.avatar_changed = false
          })
        }
      },
      vectorize_image(image) {
        this.avatar_changed = true
        this.working = true
        const avatar_id = profile_id.as_avatar_id(this.me.id)
        Vue.nextTick(() => {
          convert_to_avatar.trace(image, avatar_id).then(avatar => {
            this.working = false
            this.me.avatar = avatar
          })
        })
      },
      attach_poster(event) {
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
    & > svg
      fill: white
      width: 100vw
      min-height: 100vh
      &.working
        flex-grow: 1
        padding: base-line
        width: 100vw
        height: 50vh
    & > menu
      display: flex
      justify-content: space-between
      margin-top: -(base-line * 3)
      padding: 0 base-line base-line base-line
      & > a
        cursor: pointer
        &#download-avatar
          display: none
          @media (min-width: max-screen)
            display: inherit
    & > div
      max-width: page-width
      margin: auto
      padding: base-line base-line 0 base-line
      & > form
        margin-top: base-line
    & > input[type=file]
      display: none
    &.signed_in
      & > header
        margin-bottom: -(base-line * 4)
        position: relative
        z-index: 2
      & > div > form
        #phone
          display: none
</style>
