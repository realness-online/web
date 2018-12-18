<template>
  <section id="upload">
    <input type="file" accept="image/jpeg" capture ref="file_upload" v-uploader>
    <icon v-if="working" name="working"></icon>
    <profile-as-figure v-else :person='person'></profile-as-figure>
    <footer>
      <menu v-if="me">
        <button @click='finished_viewing'>
          <icon name="remove"></icon>
        </button>
        <a @click="open_camera">
          <icon name="add"></icon>
        </a>
        <a @click="accept_changes">
          <icon name="finished"></icon>
        </a>
      </menu>
      <menu v-else>
        <button @click='finished_viewing'>
          <icon name="finished"></icon>
        </button>
      </menu>
    </footer>
  </section>
</template>
<script>
  import icon from '@/components/icon'
  import profileAsFigure from '@/components/profile/as-figure'
  import {person_storage} from '@/modules/Storage'
  import convert_to_avatar from '@/modules/ConvertToAvatar'
  import profile_init from '@/mixins/profile_init'
  export default {
    mixins: [profile_init],
    components: {
      icon, profileAsFigure
    },
    methods: {
      open_camera(event) {
        this.working = true
        this.$refs.file_upload.click()
      },
      accept_changes(event) {
        this.working = true
        const route = {
          path: `/account`
        }
        person_storage.save().then(() => {
          console.log('person saved')
          this.$router.push(route)
        })
      },
      finished_viewing() {
        const route = {
          path: sessionStorage.previous
        }
        this.$router.push(route)
      }
    },
    directives: {
      uploader: {
        bind(input, binding, vnode) {
          input.addEventListener('change', event => {
            const avatar_image = event.target.files[0]
            if (avatar_image !== undefined) {
              if (avatar_image.type === 'image/jpeg') {
                const identifier = `+1${vnode.context.person.mobile}_avatar`
                convert_to_avatar.trace(avatar_image, identifier).then(avatar => {
                  vnode.context.working = false
                  vnode.context.person.avatar = avatar
                })
              }
            }
          })
        }
      }
    }
  }
</script>
<style lang="stylus">
  @require '../style/variables'
  section#upload
    animation-name: slideInLeft
    height: 100vh
    display: flex
    flex-direction: column
    justify-content: flex-start
    align-content: stretch
    figure.profile
      margin-top: base-line * 1.5
      padding: 0
      flex-grow: 1
      display: flex
      flex-direction: column
      justify-content: flex-start
      align-content: stretch
      & > svg
        animation-name: slideInDown
        border-radius: 100vw
        width: 100vw
        height:100vw
        max-height: 90vh
      & > figcaption
        display:none
    input[type=file]
      display: none
    svg.working
      flex-grow: 1
      padding: base-line
      padding-top: base-line * 6
      width:100vw
      height:50vh
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
