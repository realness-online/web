<template lang="html">
  <svg @click="avatar_click" :preserveAspectRatio="preserve_aspect_ratio">
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
      },
      preserve_aspect_ratio: {
        type: String,
        default: 'xMidYMid slice'
      }
    },
    // created() {
    //   Vue.nextTick(() => this.fit_avatar())
    // },
    // mounted() {
    //   console.log('mounted');
    //   Vue.nextTick(() => this.fit_avatar())
    // },
    updated() {
      console.log('updated');
      this.fit_avatar()
    },
    methods: {
      avatar_click(event) {
        this.$emit('avatar-clicked', event)
      },
      fit_avatar() {
        const avatar_id = profile_id.as_avatar_id(this.person.id)
        const avatar = document.getElementById(avatar_id)
        if (avatar) {
          console.log('avatar found!');
          avatar.setAttribute('preserveAspectRatio', this.preserve_aspect_ratio)
        }
        else {
          console.log('avatar not found')
        }
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
