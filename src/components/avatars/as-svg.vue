<template lang="html">
  <svg @click="avatar_click">
    <defs>
      <symbol v-if="avatar" :id="id"
              :viewBox="avatar.view_box"
              :preserveAspectRatio="aspect_ratio"
              v-html="avatar.path"></symbol>
    </defs>
    <icon v-if="!working" name="background"></icon>
    <use :href="avatar_link"/>
  </svg>
</template>
<script>
  import { avatars_storage } from  '@/persistance/Storage'
  import profile from '@/helpers/profile'
  import icon from '@/components/icon'
  import icons from '@/icons.svg'
  export default {
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
    data() {
      return {
        observer: null,
        avatar: null,
        slice: true
      }
    },
    created() {
      if (this.me) this.avatar = avatars_storage.as_object()
    },
    async mounted() { this.intersect() },
    async updated() { this.intersect() },
    destroyed() {
      if (this.observer) this.observer.unobserve(this.$el)
    },
    computed: {
      aspect_ratio() {
        if (this.slice) return `xMidYMid slice`
        else return `xMidYMid meet`
      },
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
        this.slice =! this.slice
        this.$emit('avatar-clicked', event)
      },
      async show_avatar(entries) {
        entries.forEach(async entry => {
          if (entry.isIntersecting) {
            if (this.first_instance() && this.person.avatar) {
              this.avatar = await profile.item(this.person.id, this.person.avatar)
              this.$emit('loaded', this.avatar)
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
