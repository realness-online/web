<template>
  <section id="upload">
    <input id="avatar_picker" type="file" accept="image/*" ref="file_upload" v-uploader>
    <icon name="working"></icon>
    <profile-as-figure :person='person' :me="true"></profile-as-figure>
    <footer>
      <icon name="remove"></icon>
      <icon name="add"></icon>
      <router-link to="/account">
        <icon name="finished"></icon>
      </router-link>
    </footer>
  </section>
</template>
<script>
  import icon from '@/components/icon'
  import profileAsFigure from '@/components/profile/as-figure'
  import {person_storage} from '@/modules/Storage'
  export default {
    components: {
      icon, profileAsFigure
    },
    data() {
      return {
        person: person_storage.as_object()
      }
    },
    directives: {
      uploader: {
        bind(input, binding, vnode) {
          input.addEventListener('change', event => {
            const avatar_image = event.target.files[0]
            if (avatar_image !== undefined) {
              if (avatar_image.type === 'image/jpeg') {
                // convert_to_avatar.trace().then(file)
                // avatar_storage.persist(avatar_image).then(result => {
                //   Vue.nextTick(() => person_storage.save())
                // })
              }
              vnode.context.file = avatar_image
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
      display:none
      width:(100vw - base-line)
      height:100vh
    & > footer
      padding: base-line
      display: flex
      justify-content: space-between
      & > svg
        opacity: 0.5
</style>
