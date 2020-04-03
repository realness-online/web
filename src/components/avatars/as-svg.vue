<template lang="html">
  <svg @click="vector_click">
    <defs>
      <symbol v-if="avatar" :id="id"
              :viewBox="avatar.viewbox"
              :preserveAspectRatio="aspect_ratio"
              v-html="avatar.path"></symbol>
    </defs>
    <icon v-if="!working" name="background"></icon>
    <use :href="avatar_link"/>
  </svg>
</template>
<script>
  import { avatars_storage } from '@/persistance/Storage'
  import profile from '@/helpers/profile'
  import itemid from '@/helpers/itemid'
  import vector_intersection from '@/mixins/vector_intersection'
  import vector_click from '@/mixins/vector_click'
  import icon from '@/components/icon'
  import icons from '@/icons.svg'
  export default {
    mixins: [vector_intersection, vector_click],
    components: {
      icon
    },
    props: {
      person: Object,
      me: {
        type: Boolean,
        required: false,
        default: false
      },
      working: {
        type: Boolean,
        default: false
      }
    },
    data () {
      return {
        avatar: null
      }
    },
    created () {
      if (this.me) this.avatar = avatars_storage.as_object()
    },
    computed: {
      id () {
        return profile.as_avatar_id(this.person.id)
      },
      avatar_link () {
        if (this.working) return `${icons}#working`
        if (this.person.avatar) return profile.as_avatar_fragment(this.person.id)
        else return `${icons}#silhouette`
      }
    },
    methods: {
      first_instance () {
        if (document.getElementById(this.id)) return false
        else return true
      },
      async show () {
        console.log('avatars/as-svg')
        if (this.first_instance() && this.person.avatar) {
          this.avatar = await itemid.load(`${this.person.id}/${this.person.avatar}`)
          this.$emit('loaded', this.avatar)
        }
      }
    }
  }
</script>
<style lang="stylus">
  .background
    fill: blue
</style>
