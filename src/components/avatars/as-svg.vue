<template lang="html">
  <svg @click="avatar_click">
    <defs>
      <symbol id="background">
        <rect width="100%" height="100%"/>
      </symbol>
      <symbol v-if="avatar" :id="id"
              :viewBox="avatar.view_box"
              preserveAspectRatio="xMidYMid slice"
              v-html="avatar.path"></symbol>
    </defs>
    <use href="#background"/>
    <use :href="avatar_link"/>
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
      }
    },
    data() {
      return {
        observer: null,
        avatar: null
      }
    },
    async updated() {
      if (this.observer) this.observer.unobserve(this.$el)
      this.observer = new IntersectionObserver(this.show_avatar)
      await this.$nextTick()
      this.observer.observe(this.$el)
    },
    destroyed() {
      if (this.observer) this.observer.unobserve(this.$el)
    },
    methods: {
      first_instance() {
        if (document.getElementById(this.id)) return false
        else return true
      },
      avatar_click(event) {
        this.$emit('avatar-clicked', event)
      },
      async show_avatar(entries) {
        entries.forEach(async entry => {
          if (entry.isIntersecting) {
            if (this.first_instance() && this.person.avatar) {
              this.avatar = await profile.item(this.person.id, this.person.avatar)
              this.observer.unobserve(this.$el)
            }
          }
        })
      }
    },
    computed: {
      id() {
        return profile.as_avatar_id(this.person.id)
      },
      avatar_link() {
        if (this.working) return `${icons}#working`
        if (this.person.avatar) return profile.as_avatar_fragment(this.person.id)
        else return `${icons}#silhouette`
      }
    }
  }
</script>
<style lang="stylus">
  #background rect
    fill: blue
</style>
