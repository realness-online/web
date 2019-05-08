<template lang="html">
  <section id="account" v-bind:class="{signed_in}" class="page">
    <header>
      <icon name="nothing"></icon>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup>
      <h1>Account</h1>
      <icon v-show="working" name="working"></icon>
    </hgroup>
    <div id="login">
      <profile-as-figure :person="me"></profile-as-figure>
      <profile-as-form :person='me'></profile-as-form>
    </div>
    <div id="manage-avatar" v-if="signed_in">
      <profile-as-avatar :person="me"></profile-as-avatar>
      <menu>
        <a @click="open_camera"><icon name="add"></icon></a>
        <a v-if="avatar_changed" @click="accept_changes"><icon name="finished"></icon></a>
        <a :href="downloadable" download='vector.svg'>Download</a>
      </menu>
      <icon v-if="working" name="working"></icon>
      <input type="file" accept="image/jpeg" capture ref="uploader" v-uploader>
    </div>
    <article id="manage-posts">
      <header>
        <h1>Posts</h1>
      </header>
      <posts-as-list :posts="my_posts"></posts-as-list>
    </article>
  </section>
</template>
<script>
  import Vue from 'vue'
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import icon from '@/components/icon'
  import { person_storage, posts_storage } from '@/modules/Storage'
  import profile_id from '@/modules/profile_id'
  import profile_as_figure from '@/components/profile/as-figure'
  import profile_as_form from '@/components/profile/as-form'
  import profile_as_avatar from '@/components/profile/as-avatar'
  import posts_as_list from '@/components/posts/as-list'
  import logo_as_link from '@/components/logo-as-link'
  import convert_to_avatar from '@/modules/convert_to_avatar'
  export default {
    components: {
      'profile-as-figure': profile_as_figure,
      'profile-as-form': profile_as_form,
      'profile-as-avatar': profile_as_avatar,
      'posts-as-list': posts_as_list,
      'logo-as-link': logo_as_link,
      icon,
    },
    data() {
      return {
        working: false,
        me: person_storage.as_object(),
        my_posts: posts_storage.as_list(),
        signed_in: false,
        avatar_changed: false,
        image_file: null
      }
    },
    created() {
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          const id = profile_id.from_e64(user.phoneNumber)
          this.signed_in = true
          profile_id.load(id).then(profile => {
            this.me = profile
            this.me.id = id
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
            this.me.id = profile_id.from_e64(user.phoneNumber)
          }
          Vue.nextTick(() => person_storage.save())
        })
      })
    },
    computed: {
      downloadable() {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
          ${this.me.avatar}
          <use href="${profile_id.as_avatar_fragment(this.me.id)}"/>
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
        console.log(this.me)
        convert_to_avatar.trace(image, profile_id.as_avatar_id(this.me.id))
        .then(avatar => {
          this.working = false
          this.me.avatar = avatar
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
    padding: base-line
    max-width: page-width
    margin: auto
    & > hgroup > h1
      color: black
    & > header
      padding: 0
      margin-bottom: base-line
    & div#manage-avatar > svg
      fill: black
      width: 100vw
      min-height: 100vh
      &.working
        flex-grow: 1
        padding: base-line
        width:100vw
        height:50vh
    & > details[open]
      & > summary > h1 > span
        display:none
    & > div
      display: flex
      flex-flow: column
      justify-content: space-between
    & > div
      & > input[type=file]
        display: none
      & > a
        margin-bottom: base-line
        standard-button: black
      & > button
        margin-bottom: base-line
    &.signed_in
      & > div > form
        width: inherit
        #name
        #phone
          display:none
</style>
