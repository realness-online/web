<template>
  <svg :viewBox="viewbox" :preserveAspectRatio="aspect_ratio" @click="vector_click">
    <icon v-if="working" name="working" />
    <icon v-else name="background" />
    <template v-if="person.avatar">
      <g v-for="(symbol, index) in path" :key="index">
        <symbol :id="symbol_id(index)" :viewBox="viewbox" v-html="symbol" />
        <use :href="symbol_fragment(index)" />
      </g>
    </template>
    <use v-else :href="silhouette" />
  </svg>
</template>
<script>
  import { as_query_id, as_fragment, load } from '@/helpers/itemid'
  import intersection from '@/mixins/intersection'
  import vector_click from '@/mixins/vector_click'
  import vector from '@/mixins/vector'
  import icon from '@/components/icon'
  import icons from '@/style/icons.svg'
  export default {
    components: {
      icon
    },
    mixins: [intersection, vector_click, vector],
    props: {
      person: {
        type: Object,
        required: true
      }
    },
    emits: ['vector-loaded'],
    computed: {
      id() {
        if (this.person.avatar) return as_query_id(this.person.avatar)
        else return null
      },
      silhouette() {
        if (this.working) return `${icons}#working`
        if (this.person.avatar) return as_fragment(this.person.avatar)
        else return `${icons}#silhouette`
      }
    },
    methods: {
      first_instance() {
        const element = document.getElementById(this.id)
        if (element) return false
        else return true
      },
      async show() {
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
