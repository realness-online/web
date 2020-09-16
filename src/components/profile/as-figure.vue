<template>
  <figure class="profile">
    <as-svg :person="person" @vector-click="avatar_click" />
    <figcaption>
      <as-hgroup :key="person.id" :person="person" :editable="editable" />
      <menu>
        <slot />
      </menu>
    </figcaption>
  </figure>
</template>
<script>
  import { AsYouType } from 'libphonenumber-js'
  import profile from '@/helpers/profile'
  import as_svg from '@/components/avatars/as-svg'
  import as_hgroup from '@/components/profile/as-hgroup'
  export default {
    components: {
      'as-svg': as_svg,
      'as-hgroup': as_hgroup
    },
    props: {
      person: {
        type: Object,
        required: true
      },
      editable: {
        type: Boolean,
        required: false,
        default: false
      }
    },
    computed: {
      is_me () {
        if (localStorage.me === this.person.id) return true
        else return false
      },
      sms_link () {
        return `sms:${this.person.id}`
      },
      mobile_display () {
        let phone_number = profile.as_phone_number(this.person.id)
        if (this.person.mobile) phone_number = this.person.mobile
        return new AsYouType('US').input(phone_number)
      }
    },
    methods: {
      avatar_click (event) {
        const route = { path: this.person.id }
        if (this.is_me) route.path = '/account'
        this.$router.push(route)
      }
    }
  }
</script>
<style lang="stylus">
  figure.profile
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
    display:flex
    justify-content: space-between
    #background
      fill: blue
    & > svg
      width: 4rem
      height: 4rem
      cursor: pointer
      @media (max-width: pad-begins)
        border-top-right-radius: 0.66rem
        border-bottom-right-radius: 0.66rem
      border: 1px solid blue
      @media (min-width: pad-begins)
        border-radius: 0.66rem
      &.background
        fill: blue
    & > figcaption
      flex: 1
      display: flex
      & > hgroup
        padding: (base-line / 3)
        flex: 1
      & > menu
        padding-right: (base-line / 2)
        padding-left: (base-line / 3)
        padding-top: (base-line / 2)
        opacity: 0.66
        &:hover
          opacity: 1
</style>
