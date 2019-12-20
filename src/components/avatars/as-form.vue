<template lang="html">
  <div id="manage-avatar">
    <icon v-if="working" name="working"></icon>
    <div v-else>
      <avatar-as-figure v-if="avatar" :avatar="avatar"></avatar-as-figure>
      <avatar-as-svg v-else :person="person"></avatar-as-svg>
    </div>
    <menu v-if="signed_in">
      <a id="open_camera" @click="open_camera"><icon name="camera"></icon></a>
      <a id="accept_changes" @click="accept_new_avatar" v-if="avatar">
        <icon v-if="finished" name="finished"></icon>
        <icon v-else name="working"></icon>
      </a>
      <a id="select_photo" @click="select_photo"><icon name="add"></icon></a>
    </menu>
    <input type="file" accept="image/jpeg" capture ref="uploader" v-uploader>
  </div>
</template>
<script>
  import { avatars_storage } from '@/storage/Storage'
  import profile from '@/helpers/profile'
  import icon from '@/components/icon'
  import as_svg from '@/components/avatars/as-svg'
  import as_figure from '@/components/avatars/as-figure'
  import signed_in from '@/mixins/signed_in'
  import uploader from '@/mixins/uploader'
  export default {
    mixins: [signed_in, uploader],
    components: {
      icon,
      'avatar-as-svg': as_svg,
      'avatar-as-figure': as_figure
    },
    props: {
      person: Object
    },
    data() {
      return {
        worker: new Worker('/vector.worker.js'),
        working: false,
        finished: true,
        avatar: null
      }
    },
    created() {
      this.worker.addEventListener('message', this.set_new_avatar)
    },
    methods: {
      set_new_avatar(message) {
        this.avatar_changed = true
        this.avatar = {
          id: `avatars/${message.data.created_at}`,
          path: message.data.path,
          view_box: message.data.view_box,
          created_at: new Date(message.data.created_at).toISOString(),
          created_by: this.person.id
        }
        console.log(this.avatar.id)
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
        this.finished = true
      }
    }
  }
</script>
<style lang="stylus">
  div#manage-avatar
    position: relative
    & div svg
      &.background
        fill: red
      width: 100vw
      min-height: 100vh
    &.working
      min-height: 100vh
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
    & > input[type=file]
      display: none
</style>
