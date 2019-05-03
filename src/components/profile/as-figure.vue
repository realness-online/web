<template>
  <figure class="profile" itemscope itemtype='/person' :itemid="this.person.id">
    <svg @click="avatar_click">
      <defs v-if="!avatar_by_reference" ref="avatar" itemprop="avatar" v-html="person.avatar"></defs>
      <use :xlink:href="avatar"/>
    </svg>
    <figcaption>
      <p>
        <span itemprop="first_name">{{person.first_name}}</span>
        <span itemprop="last_name">{{person.last_name}}</span>
      </p>
      <p v-if="is_me">{{mobile_display}}</p>
      <a v-else :href="sms_link">{{mobile_display}}</a>
    </figcaption>
  </figure>
</template>
<script>
  import Vue from 'vue'
  import { person_storage } from '@/modules/Storage'
  import { AsYouType } from 'libphonenumber-js'
  import icons from '@/icons.svg'
  import profile_id from '@/modules/profile_id'
  export default {
    props: {
      person: Object,
      previous: {
        type: Boolean,
        default: false
      },
      click_to_avatar: {
        type: Boolean,
        default: false
      },
      avatar_by_reference: {
        type: Boolean,
        default: false
      },
      just_display_avatar: {
        type: Boolean,
        default: false
      },
      nav: {
        type: Boolean,
        default: true
      }
    },
    updated() {
      Vue.nextTick(() => this.fit_avatar())
    },
    methods: {
      fit_avatar() {
        const avatar_id = profile_id.as_avatar_id(this.person.id)
        console.log(avatar_id, 'fit_avatar', this.$refs.avatar)

        document.getElementById(avatar_id).setAttribute('preserveAspectRatio', 'xMidYMid slice')
      },
      avatar_click(event) {
        let route = {
          path: this.person.id
        }
        if (this.click_to_avatar) {
          route.path = `${this.person.id}/avatar`
        }
        if (this.is_me) {
          route.path = '/account'
        }
        if (this.previous) {
          route.path = sessionStorage.previous
        }
        if (!this.just_display_avatar) {
          this.$router.push(route)
        }
      }
    },
    computed: {
      is_me() {
        return person_storage.as_object().id === this.person.id
      },
      avatar() {
        if (this.person.avatar) {
          return profile_id.as_avatar_fragment(this.person.id)
        }
        return `${icons}#silhouette`
      },
      sms_link() {
        return `tel:${this.person.id}`
      },
      mobile_display() {
        return new AsYouType('US').input(profile_id.as_phone_number(this.person.id))
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
    & > svg
      clip-path: circle(50%)
      cursor: pointer
      fill: black
      stroke: lighten(black, 20%)
      stroke-width: (base-line / 36)
      @media (prefers-color-scheme: dark)
        fill: white
        stroke: lighten(black, 99%)
    & > figcaption
      padding-left: (base-line / 2)
      vertical-align: middle
      line-height: (base-line * 2)
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
