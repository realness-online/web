<template lang="html">
  <div id="manage-avatar">
    <icon v-if="working" name="working"></icon>
    <as-avatar v-else :person="person" :by_reference="true"></as-avatar>
    <menu v-if="signed_in">
      <a id="open_camera" @click="open_camera"><icon name="camera"></icon></a>
      <a id="accept_changes" @click="accept_changes" v-if="avatar_changed">
        <icon v-if="finished" name="finished"></icon>
        <icon v-else name="working"></icon>
      </a>
      <a id="select_photo" @click="select_photo"><icon name="add"></icon></a>
    </menu>
    <input type="file" accept="image/jpeg" capture ref="uploader" v-uploader>
  </div>
</template>
<script>
  import { person_local as me } from '@/classes/LocalStorage'
  import profile from '@/helpers/profile'
  import icon from '@/components/icon'
  import as_avatar from '@/components/profile/as-avatar'
  import signed_in from '@/mixins/signed_in'
  import uploader from '@/mixins/uploader'
  export default {
    mixins: [signed_in, uploader],
    components: {
      icon,
      'as-avatar': as_avatar
    },
    props: {
      person: Object
    },
    data() {
      return {
        worker: new Worker('/vector.worker.js'),
        working: false,
        finished: true,
        avatar_changed: false
      }
    },
    created() {
      this.worker.addEventListener('message', this.worker_event)
    },
    methods: {
      as_symbol(data) {
        const id = profile.as_avatar_id(me.as_object().id)
        return `<symbol viewBox="0 0 ${data.width} ${data.height}" id="${id}" preserveAspectRatio="xMidYMid slice">${data.vector}</symbol>`
      },
      worker_event(message) {
        this.avatar_changed = true
        this.$emit('new-avatar', this.as_symbol(message.data))
        this.working = false
      },
      vectorize_image(image) {
        this.working = true
        this.worker.postMessage({ image, width: 512 })
      },
      async accept_changes(event) {
        this.finished = false
        await me.save()
        this.finished = true
        this.avatar_changed = false
      }
    }
  }
</script>
<style lang="stylus">
  div#manage-avatar
    position: relative
    & > svg
      width: 100vw
      min-height: 100vh
      &.working
        flex-grow: 1
        padding: base-line
        width: 30vw
        height: 15vh
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
          fill: red
        &#accept_changes > svg
          fill: green
    & > input[type=file]
      display: none
</style>
