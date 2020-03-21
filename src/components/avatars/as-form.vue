<template lang="html">
  <div id="manage-avatar">
    <icon v-if="working" name="working"></icon>
    <div v-else>
      <avatar-as-figure v-if="avatar" :avatar="avatar"></avatar-as-figure>
      <avatar-as-svg  v-else @loaded="set_current_avatar" :me="true" :person="person"></avatar-as-svg>
    </div>
    <menu v-if="show_menu">
      <a id="open_camera" @click="open_camera">
        <icon name="camera"></icon>
      </a>
      <a id="select_photo" @click="select_photo">
        <icon name="add"></icon>
      </a>
      <a id="accept_changes" @click="accept_new_avatar" v-if="avatar_changed">
        <icon v-if="finished" name="finished"></icon>
        <icon v-else name="working"></icon>
      </a>
      <download-vector v-if="download_vector" :vector="current_avatar"></download-vector>
    </menu>
    <input type="file" accept="image/jpeg" capture ref="uploader" v-uploader>
  </div>
</template>
<script>
  import { avatars_storage } from '@/persistance/Storage'
  import profile from '@/helpers/profile'
  import icon from '@/components/icon'
  import download_vector from '@/components/download-vector'
  import as_svg from '@/components/avatars/as-svg'
  import as_figure from '@/components/avatars/as-figure'
  import signed_in from '@/mixins/signed_in'
  import uploader from '@/mixins/uploader'
  export default {
    mixins: [signed_in, uploader],
    components: {
      icon,
      'download-vector': download_vector,
      'avatar-as-svg': as_svg,
      'avatar-as-figure': as_figure
    },
    props: {
      person: Object
    },
    data() {
      return {
        worker: new Worker('/vector.worker.js'),
        current_avatar: null,
        avatar_changed: false,
        working: false,
        finished: true,
        avatar: null
      }
    },
    async created() {
      this.worker.addEventListener('message', this.set_new_avatar)
      this.current_avatar = await profile.item(this.person.id, this.person.avatar)
    },
    methods: {
      set_current_avatar(avatar) {
        this.current_avatar = avatar
      },
      set_new_avatar(message) {
        this.avatar_changed = true
        this.avatar = {
          id: `avatars/${message.data.created_at}`,
          path: message.data.path,
          view_box: message.data.view_box,
          created_at: new Date(message.data.created_at).toISOString(),
          created_by: this.person.id
        }
        this.current_avatar = this.avatar
        avatars_storage.filename = this.avatar.id
        this.working = false
      },
      vectorize_image(image) {
        this.working = true
        this.worker.postMessage({ image })
      },
      async accept_new_avatar(event) {
        this.avatar_changed = false
        this.finished = false
        await this.$nextTick()
        await avatars_storage.save()
        this.$emit('new-avatar', this.avatar.id)
        this.avatar = null
        this.finished = true
      }
    },
    computed: {
      download_vector() {
        if (!this.avatar_changed && this.current_avatar) return true
        else return false
      },
      show_menu() {
        if (this.signed_in && !this.working) return true
        else return false
      }
    }
  }
</script>
<style lang="stylus">
  div#manage-avatar
    position: relative
    & div svg
      width: 100vw
      min-height: 100vh
      &.background
        fill: red
    & > svg.working
      height: 100vh
      width: base-line * 5
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
          fill: blue
        &#accept_changes > svg
          fill: green
        @media (min-width: pad-begins)
          &#open_camera
            display: none
    & > input[type=file]
      display: none
</style>
