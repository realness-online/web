<template lang="html">
  <svg @click="vector_click">
    <defs>
      <symbol v-if="vector" :id="id"
              :viewBox="vector.viewbox"
              :preserveAspectRatio="aspect_ratio"
              v-html="path" />
    </defs>
    <icon v-if="!working" name="background" />
    <use :href="avatar_link" />
  </svg>
</template>
<script>
  import { as_query_id, as_fragment, load } from '@/helpers/itemid'
  import intersection from '@/mixins/intersection'
  import vector_click from '@/mixins/vector_click'
  import vector from '@/mixins/vector'
  import icon from '@/components/icon'
  import icons from '@/icons.svg'
  export default {
    components: {
      icon
    },
    mixins: [intersection, vector_click, vector],
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
    computed: {
      id () {
        if (this.person.avatar) return as_query_id(this.person.avatar)
        else return null
      },
      avatar_link () {
        if (this.working) return `${icons}#working`
        if (this.person.avatar) return as_fragment(this.person.avatar)
        else return `${icons}#silhouette`
      }
    },
    methods: {
      first_instance () {
        const element = document.getElementById(this.id)
        if (element) return false
        else return true
      },
      async show () {
        if (this.vector) return
        if (this.first_instance() && this.person.avatar) {
          this.vector = await load(this.person.avatar)
          await this.$nextTick()
          this.$emit('vector-loaded', this.vector)
        }
      }
    }
  }
</script>
