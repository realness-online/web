<template lang="html">
  <svg>
    <defs itemprop="avatar" :itemref="person.id" v-if="!by_reference" ref="avatar" v-html="person.avatar"></defs>
    <use :xlink:href="avatar_link"/>
  </svg>
</template>
<script>
  import Vue from 'vue'
  import profile_id from '@/modules/profile_id'
  import icons from '@/icons.svg'
  export default {
    props: {
      person: Object,
      by_reference: {
        type: Boolean,
        default: false
      }
    },
    mounted() {
      Vue.nextTick(() => this.fit_avatar())
    },
    updated() {
      Vue.nextTick(() => this.fit_avatar())
    },
    methods: {
      fit_avatar() {
        const avatar_id = profile_id.as_avatar_id(this.person.id)
        document.getElementById(avatar_id).setAttribute('preserveAspectRatio', 'xMidYMid slice')
      }
    },
    computed: {
      avatar_link() {
        if (this.person.avatar) {
          return profile_id.as_avatar_fragment(this.person.id)
        }
        return `${icons}#silhouette`
      }
    }
  }
</script>
