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
        return itemid.as_query_id(this.person.avatar)
      },
      avatar_link () {
        if (this.working) return `${icons}#working`
        if (this.person.avatar) return itemid.as_fragment(this.person.avatar)
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
          console.log(this.person.avatar)
          this.avatar = await itemid.load(this.person.avatar)
          this.$emit('vector-loaded', this.avatar)
        }
      }
    }
  }
</script>
<style lang="stylus">
  .background
    fill: blue
</style>
