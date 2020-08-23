<template>
  <figure class="profile">
    <as-svg :person="person" @vector-clicked="avatar_click" />
    <figcaption>
      <as-hgroup :key="person.id" :person="person" />
      <p v-if="is_me" class="phone">{{ mobile_display }}</p>
      <a v-else class="phone" @click="open_sms_app">{{ mobile_display }}</a>
    </figcaption>
    <slot />
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
      },
      open_sms_app (event) {
        window.open(this.sms_link, '_self')
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
      min-height: base-line * 2
      min-width: base-line * 2
      cursor: pointer
      border-radius: base-line
      shape-outside: circle()
      margin-right: (base-line / 4)
      &.background
        fill: blue
    & > figcaption
      flex: 1
      .phone
        margin-bottom: 0
        font-weight: 300
        user-select: none
      & > a
        display:block
</style>
