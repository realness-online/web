<template lang="html">
  <svg @click="avatar_click">
    <defs>
      <symbol v-if="avatar" :id="id"
              :viewBox="avatar.view_box"
              preserveAspectRatio="xMidYMid slice"
              v-html="avatar.path"></symbol>
    </defs>
    <icon v-if="!working" name="background"></icon>
    <use :href="avatar_link"/>
  </svg>
</template>
<script>
  import profile from '@/helpers/profile'
  import icon from '@/components/icon'
  import icons from '@/icons.svg'
  export default {
    components: {
      icon
    },
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
    async mounted() { this.intersect() },
    async updated() { this.intersect() },
    destroyed() {
      if (this.observer) this.observer.unobserve(this.$el)
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
    },
    methods: {
      async intersect() {
        if (this.observer) this.observer.unobserve(this.$el)
        this.observer = new IntersectionObserver(this.show_avatar)
        await this.$nextTick()
        this.observer.observe(this.$el)
      },
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
    }
  }
</script>
<style lang="stylus">
  .background
    fill: blue
</style>
