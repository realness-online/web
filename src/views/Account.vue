<template lang="html">
  <section id="account" v-bind:class="{signed_in}" class="page">
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
        auth: firebase.auth(),
        me: {},
        working: false,
        signed_in: false,
        avatar_changed: false,
        image_file: null
      }
    },
    async created() {
      this.me = await person_storage.as_object()
      const user = this.auth.currentUser
      if (user) {
        this.signed_in = true
        const id = profile_id.from_e64(user.phoneNumber)
        this.me = await profile_id.load(id)
      }
      this.$bus.$off('save-me')
      this.$bus.$on('save-me', () => this.save_me())
    },
    computed: {
      show_avatar() {
        if (this.signed_in && !this.working) {
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
      async save_me() {
        const user = this.auth.currentUser
        if (user) {
          this.me.id = profile_id.from_e64(user.phoneNumber)
          if (!this.me.avatar) {
            console.log('no avatar', this.me.id)
            const profile = await profile_id.load(this.me.id)
            this.me.avatar = profile.avatar
          }
        }
        this.$nextTick(_ => person_storage.save())
      },
      async vectorize_image(image) {
        this.working = true
        this.avatar_changed = true
        const avatar_id = profile_id.as_avatar_id(this.me.id)
        this.$nextTick(async() => {
          this.me.avatar = await convert_to_avatar.trace(image, avatar_id)
          this.working = false
        })
      },
      async accept_changes(event) {
        if (this.avatar_changed) {
          await person_storage.save()
          this.avatar_changed = false
        }
      },
      open_camera(event) {
        this.$refs.uploader.setAttribute('capture', true)
        this.$refs.uploader.click()
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
