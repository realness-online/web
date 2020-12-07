<template lang="html">
  <div id="manage-avatar">
    <icon v-if="working" name="working" />
    <div v-else>
      <figure v-if="avatar">
        <icon name="background" />
        <svg itemscope itemtype="/avatars"
             :itemid="avatar.id"
             :viewBox="avatar.viewbox"
             v-html="path" />
      </figure>
      <avatar-as-svg v-else :person="person" @vector-loaded="set_current_avatar" />
    </div>
    <menu v-if="show_menu">
      <a id="open_camera" @click="open_camera">
        <icon name="camera" />
      </a>
      <a id="select_photo" @click="select_photo">
        <icon name="add" />
      </a>
      <a v-if="avatar_changed" id="accept_changes" @click="accept_new_avatar">
        <icon v-if="finished" name="finished" />
        <icon v-else name="working" />
      </a>
      <download-vector v-if="download_vector" :itemid="current_avatar.id" />
    </menu>
    <input ref="uploader" v-uploader type="file" accept="image/jpeg" capture="user">
  </div>
</template>
<script>
  import { Avatar } from '@/persistance/Storage'
  import itemid from '@/helpers/itemid'
  import icon from '@/components/icon'
  import download_vector from '@/components/download-vector'
  import as_svg from '@/components/avatars/as-svg'
  import signed_in from '@/mixins/signed_in'
  import vector_path from '@/mixins/vector_path'
  import uploader from '@/mixins/uploader'
  export default {
    components: {
      icon,
      'download-vector': download_vector,
      'avatar-as-svg': as_svg
    },
    mixins: [signed_in, uploader, vector_path],
    props: {
      person: {
        type: Object,
        required: true
      }
    },
    data () {
      return {
        worker: new Worker('/vector.worker.js'),
        avatar: null,
        current_avatar: null,
        avatar_changed: false,
        working: false,
        finished: true
      }
    },
    computed: {
      download_vector () {
        if (!this.avatar_changed && this.current_avatar) return true
        else return false
      },
      show_menu () {
        if (this.signed_in && !this.working) return true
        else return false
      }
    },
    async created () {
      this.worker.addEventListener('message', this.set_new_avatar)
      if (this.person.avatar) this.current_avatar = await itemid.load(this.person.avatar)
    },
    destroyed () {
      this.worker.terminate()
    },
    methods: {
      set_current_avatar (avatar) {
        this.current_avatar = avatar
      },
      set_new_avatar (message) {
        this.avatar_changed = true
        this.vector = {
          id: `${this.person.id}/avatars/${message.data.created_at}`,
          path: message.data.path,
          viewbox: message.data.viewbox
        }
        this.current_avatar = this.vector
        this.working = false
      },
      vectorize_image (image) {
        this.working = true
        this.worker.postMessage({ image })
      },
      async accept_new_avatar (event) {
        this.finished = false
        await this.$nextTick()
        const avatar = new Avatar(this.vector.id)
        await avatar.save()
        const updated = { ...this.person }
        updated.avatar = this.vector.id
        this.$emit('update:person', updated)
        await this.$nextTick()
        this.avatar_changed = false
        this.vector = null
        this.finished = true
      }
    }
  }
</script>
<style lang="stylus">
  div#manage-avatar
    position: relative
    & figure svg[itemscope]
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
      animation: slide-in-up
      animation-delay: 0.33s
      animation-duration: 0.35s
      animation-fill-mode: backwards
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
