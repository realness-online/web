<template lang="html">
  <svg class="poster" @click="vector_click">
    <defs>
      <symbol v-if="vector" :id="id"
              :viewBox="vector.view_box"
              :preserveAspectRatio="aspect_ratio"
              v-html="vector.path"></symbol>
    </defs>
    <use v-if="!working" :href="background" class='background'/>
    <use :href="vector_link"/>
  </svg>
</template>
<script>
  import profile from '@/helpers/profile'
  import vector_intersection from '@/mixins/vector_intersection'
  import vector_click from '@/mixins/vector_click'
  import icons from '@/icons.svg'
  export default {
    mixins: [vector_intersection, vector_click],
    props: {
      poster_id: {
        type: String,
        required: true
      },
      working: {
        type: Boolean,
        required: false,
        default: false
      }
    },
    data() {
      return {
        vector: null
      }
    },
    computed: {
      id() {
        return this.fragment_id(this.vector.id)
      },
      vector_link() {
        if (this.working) return `${icons}#working`
        if (this.poster) return this.as_fragment_id()
        else return `${icons}#mock-poster`
      },
      background() {
        return `${icons}#background`
      }
    },
    methods: {
      fragment_id(vector_id = this.vector.id) {
        const id = vector_id.replace('/', '-')
        console.log(vector_id, id)
        return '+16282281823-posters-55434443578'
      },
      first_instance() {
        if (document.getElementById(this.id)) return false
        else return true
      },
      async show() {
        if (this.first_instance()) {
          this.poster = await profile.item(this.poster.person.id, this.poster.id)
          this.$emit('vector-loaded', this.poster.id)
        }
      }
    }
  }
</script>
<style lang="stylus">
  svg.poster
    display: block
    height: 100%
    width: 100%
    max-height: poster-feed-height
  .background
    fill: green
</style>
