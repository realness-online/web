<template>
  <section id="upload">
    <input id="avatar_picker" type="file" accept="image/*" ref="file_upload" v-uploader>
    <icon v-if="working" name="working"></icon>
    <profile-as-figure v-else :person='person' :me="true"></profile-as-figure>
    <footer>
      <router-link to="/account">
        <icon name="remove"></icon>
      </router-link>
      <a @click="camera_click">
        <icon name="add"></icon>
      </a>
      <a @click="finished_click">
        <icon name="finished"></icon>
      </a>
    </footer>
  </section>
</template>
<script>
  import icon from '@/components/icon'
  import profileAsFigure from '@/components/profile/as-figure'
  import {person_storage} from '@/modules/Storage'
  import convert_to_avatar from '@/modules/ConvertToAvatar'

  export default {
    components: {
      icon, profileAsFigure
    },
    data() {
      return {
        person: person_storage.as_object(),
        working: false
      }
    },
    methods: {
      camera_click(event) {
        this.working = true
        this.$refs.file_upload.click()
      },
      finished_click(event) {
        let route = {
          path: `/account`
        }
        person_storage.save().then(() => {
          this.$router.push(route)
        })
      }
    },
    directives: {
      uploader: {
        bind(input, binding, vnode) {
          input.addEventListener('change', event => {
            const avatar_image = event.target.files[0]
            if (avatar_image !== undefined) {
              if (avatar_image.type === 'image/jpeg') {
                convert_to_avatar.trace(avatar_image).then(avatar => {
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
    animation-name: slideInDown
    height: 100vh
    display: flex
    flex-direction: column
    justify-content: flex-start
    align-content: stretch
    figure.profile
      padding: 0 base-line
      flex-grow: 1
      display: flex
      flex-direction: column
      justify-content: flex-start
      align-content: stretch
      & > svg
        flex-grow: 1
        width: 100%
      & > figcaption
        display:none
    input[type=file]
      display: none
    svg.working
      flex-grow: 1
      padding: base-line
      width:100vw
      height:50vh
    & > footer
      padding: base-line
      display: flex
      justify-content: space-between
      svg.remove
        opacity: 0.5
</style>
