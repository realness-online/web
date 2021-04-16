<template lang="html">
  <div id="manage-avatar">
    <icon v-if="working" name="working" />
    <template v-else>
      <figure v-if="vector">
        <icon name="background" />
        <svg ref="new_avatar" itemscope
             itemtype="/avatars"
             :itemid="vector.id"
             :viewBox="vector.viewbox"
             v-html="path" />
      </figure>
      <avatar-as-svg v-else :person="person" @vector-loaded="set_current_avatar" />
    </template>
    <menu v-if="show_menu">
      <a v-if="!avatar_changed" id="open_camera" @click="open_camera">
        <icon name="camera" />
      </a>
      <a v-if="!avatar_changed" id="select_photo" @click="select_photo">
        <icon name="add" />
      </a>
      <a v-if="avatar_changed" id="accept_changes" @click="accept_new_avatar">
        <icon v-if="finished" name="finished" />
        <icon v-else name="working" />
      </a>
      <as-download v-if="download_vector" :itemid="current_avatar.id" />
    </menu>
    <input ref="uploader" v-uploader type="file" accept="image/jpeg,image/png" capture="user">
  </div>
</template>
<script>
  import { Avatar } from '@/persistance/Storage'
  import get_item from '@/modules/item'
  import { load } from '@/helpers/itemid'
  import icon from '@/components/icon'
  import as_download from '@/components/download-vector'
  import as_svg from '@/components/avatars/as-svg'
  import signed_in from '@/mixins/signed_in'
  import vector from '@/mixins/vector'
  import uploader from '@/mixins/uploader'
  export default {
    components: {
      icon,
      'as-download': as_download,
      'avatar-as-svg': as_svg
    },
    mixins: [signed_in, uploader, vector],
    props: {
      person: {
        type: Object,
        required: true
      }
    },
    data () {
      return {
        vectorizer: new Worker('/vector.worker.js'),
        optimizer: new Worker('/optimize.worker.js'),
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
    watch: {
      async working () {
        if (this.vector && !this.working) {
          await this.$nextTick()
          this.optimizer.postMessage({ vector: this.$refs.new_avatar.outerHTML })
        }
      }
    },
    async created () {
      this.vectorizer.addEventListener('message', this.vectorized)
      this.optimizer.addEventListener('message', this.optimized)
      if (this.person.avatar) this.current_avatar = await load(this.person.avatar)
    },
    destroyed () {
      this.vectorizer.terminate()
      this.optimizer.terminate()
    },
    methods: {
      set_current_avatar (avatar) {
        this.current_avatar = avatar
      },
      vectorize (image) {
        this.working = true
        this.vectorizer.postMessage({ image })
      },
      async vectorized (message) {
        this.vector = {
          id: `${this.person.id}/avatars/${Date.now()}`,
          path: message.data.path,
          viewbox: message.data.viewbox
        }
        this.current_avatar = this.vector
        this.working = false
      },
      async optimized (message) {
        this.vector = get_item(message.data.vector)
        this.current_avatar = this.vector
        this.$nextTick()
        this.avatar_changed = true
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
    overflow: hidden
    position: relative
    & figure svg
      position: relative
      width: 100vw
      min-height: 100vh
      &.background
        position: absolute;
        fill: red
    & > svg
      width: 100vw
      min-height: 100vh
      &.background
        fill: red
    & > svg.working
      height: 100vh
      width: round(base-line * 5)
    & > menu
      display: flex
      justify-content: space-between
      height: 0
      padding: 0 base-line
      & > a
        animation: absolute-slide-up
        animation-delay: 0.77s
        animation-duration: 0.35s
        animation-fill-mode: both
        cursor: pointer
        position: absolute
        &#select_photo
          animation: absolute-slide-down
          animation-delay: 0.77s
          animation-duration: 0.35s
          animation-fill-mode: both
          z-index: 2
          top: inset(top, -(base-line * 2))
          left: inset(left)
        &#open_camera
          bottom: inset(bottom, -(base-line * 2))
          left: inset(left)
        &.download
          bottom: inset(bottom, -(base-line * 2))
          right: inset(right)
        & > svg
          fill: blue
        &#accept_changes
          position: absolute
          z-index: 2
          bottom: inset(bottom)
          left: inset(left)
          & > svg
            fill: green
        @media (min-width: typing-begins)
          &#open_camera
            display: none
    & > input[type=file]
      display: none
</style>
