<template>
  <figure class="profile" itemscope itemtype='/person' :itemid="item_id">
    <svg @click="avatar_click">
      <defs itemprop="avatar" v-html="person.avatar"></defs>
      <use :xlink:href="avatar"/>
    </svg>
    <figcaption>
      <p>
        <span itemprop="first_name">{{person.first_name}}</span>
        <span itemprop="last_name">{{person.last_name}}</span>
      </p>
      <p v-if="me" itemprop="mobile" :data-value="person.mobile">{{mobile_display}}</p>
      <a v-else itemprop="mobile" :data-value="person.mobile" :href="sms_link">{{mobile_display}}</a>
    </figcaption>
  </figure>
</template>
<script>
  import { AsYouType } from 'libphonenumber-js'
  import icons from '@/icons.svg'
  export default {
    props: {
      person: Object,
      previous: {
        type: Boolean,
        default: false
      },
      me: {
        type: Boolean,
        default: false
      },
      view_avatar: {
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
    methods: {
      avatar_click(event) {
        let route = {
          path: this.person.id
        }
        if (this.view_avatar) {
          route.path = `${this.person.id}/avatar`
        }
        if (this.me) {
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
      avatar() {
        if (this.person.avatar) {
          return `#avatar_1${this.person.mobile}`
        }
        return `${icons}#silhouette`
      },
      item_id() {
        return `/+1${this.person.mobile}`
      },
      sms_link() {
        return !!this.person.mobile && `sms:+1${this.person.mobile}`
      },
      mobile_display() {
        return new AsYouType('US').input(this.person.mobile)
      }
    }
  }
</script>
<style lang="stylus">
  @require '../../style/variables'
  figure.profile
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
    display:flex
    & > svg
      cursor: pointer
      fill: black
      stroke: lighten(black, 20%)
      stroke-width: (base-line / 36)
      border-radius: base-line
    & > figcaption
      padding-left: (base-line / 2)
      vertical-align: middle
      line-height: (base-line * 2)
      & > p
        color:black
        margin:0
        & > span
          text-transform: capitalize
      & > a
        display:block
</style>
