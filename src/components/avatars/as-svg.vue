<template lang="html">
  <svg @click="vector_click">
    <defs>
      <symbol v-if="avatar" :id="id"
              :viewBox="avatar.viewbox"
              :preserveAspectRatio="aspect_ratio"
              v-html="avatar.path" />
    </defs>
    <icon v-if="!working" name="background" />
    <use :href="avatar_link" />
  </svg>
</template>
<script>
  import itemid from '@/helpers/itemid'
  import intersection from '@/mixins/intersection'
  import vector_click from '@/mixins/vector_click'
  import icon from '@/components/icon'
  import icons from '@/icons.svg'
  export default {
    components: {
      icon
    },
    mixins: [intersection, vector_click],
    props: {
      person: {
        type: Object,
        required: true
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
    computed: {
      id () {
        if (this.person.avatar) return itemid.as_query_id(this.person.avatar)
        else return null
      },
      avatar_link () {
        if (this.working) return `${icons}#working`
        if (this.person.avatar) return itemid.as_fragment(this.person.avatar)
        else return `${icons}#silhouette`
      }
    },
    async mounted () {
      if (this.person.avatar && localStorage.me === this.person.id && localStorage.me.length > 2) {
       this.avatar = await itemid.load(this.person.avatar)
     }
    },
    methods: {
      first_instance () {
        if (document.getElementById(this.id)) return false
        else return true
      },
      async show () {
        if (this.first_instance() && this.person.avatar) {
          this.avatar = await itemid.load(this.person.avatar)
          this.$emit('vector-loaded', this.avatar)
        }
      }
    }
  }
</script>
