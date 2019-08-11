<template lang="html">
  <svg @click="avatar_click">
    <defs itemprop="avatar" :itemref="person.id" v-if="!by_reference" ref="avatar" v-html="person.avatar"></defs>
    <use :xlink:href="avatar_link"/>
  </svg>
</template>
<script>
  import profile from '@/helpers/profile'
  import icons from '@/icons.svg'
  export default {
    props: {
      person: Object,
      working: {
        type: Boolean,
        default: false
      },
      by_reference: {
        type: Boolean,
        default: false
      }
    },
    methods: {
      avatar_click(event) {
        this.$emit('avatar-clicked', event)
      }
    },
    computed: {
      avatar_link() {
        if (this.person.avatar) return profile.as_avatar_fragment(this.person.id)
        if (this.working) return `${icons}#working`
        else return `${icons}#silhouette`
      }
    }
  }
</script>
