<template>
  <figure class="profile">
    <as-avatar @avatar-clicked="avatar_click" :person="person"></as-avatar>
    <figcaption>
      <as-hgroup :person="person"></as-hgroup>
      <p class='phone' v-if="is_me">{{mobile_display}}</p>
      <a class='phone' v-else :href="sms_link">{{mobile_display}}</a>
    </figcaption>
  </figure>
</template>
<script>
  import { AsYouType } from 'libphonenumber-js'
  import profile from '@/helpers/profile'
  import { person_storage as me } from '@/storage/Storage'
  import as_avatar from '@/components/profile/as-avatar'
  import as_hgroup from '@/components/profile/as-hgroup'
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  export default {
    components: {
      'as-avatar': as_avatar,
      'as-hgroup': as_hgroup
    },
    props: {
      person: Object,
      previous: { // TODO: We can remove this
        type: Boolean,
        default: false
      }
    },
    methods: {
      avatar_click(event) {
        let route = { path: this.person.id }
        if (this.is_me) route.path = '/account'
        if (this.previous) route.path = sessionStorage.previous
        this.$router.push(route)
      }
    },
    computed: {
      is_me() {
        const local_id = me.as_object().id
        if (local_id) {
          if (local_id === this.person.id) return true
        } else if (firebase.auth().currentUser) {
          const my_id = profile.from_e64(firebase.auth().currentUser.phoneNumber)
          if (my_id === this.person.id) return true
        }
        return false
      },
      sms_link() {
        return `sms:${this.person.id}`
      },
      mobile_display() {
        const phone_number = profile.as_phone_number(this.item_id)
        return new AsYouType('US').input(phone_number)
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
    svg
      shape-outside: circle()
      clip-path: circle()
      cursor: pointer
    & > figcaption
      padding-left: (base-line / 2)
      vertical-align: middle
      line-height: (base-line * 2)
      .phone
        font-weight: 300
      & > p
        color: black
        margin:0
        @media (prefers-color-scheme: dark)
          color: white
        & > span
          &:first-of-type
            margin-right:(base-line / 3)
          text-transform: capitalize
      & > a
        display:block
</style>
