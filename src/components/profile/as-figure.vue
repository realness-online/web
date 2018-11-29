<template>
  <figure class="profile" itemscope itemtype='/person' :itemid="item_id">
    <svg @click="avatar_click">
      <g itemprop="avatar" v-html="person.avatar"></g>
      <use :xlink:href="avatar"/>
    </svg>
    <figcaption>
      <p>
        <span itemprop="first_name">{{person.first_name}}</span>
        <span itemprop="last_name">{{person.last_name}}</span>
      </p>
      <p v-if="me" itemprop="mobile" :data-value="person.mobile">{{mobile_display}}</p>
      <a v-else itemprop="mobile" :data-value="person.mobile" :href="sms_link">{{mobile_display}}</a>
      <meta itemprop="created_at" :content="person.created_at">
      <meta itemprop="updated_at" :content="person.updated_at">
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
      edit_avatar: {
        type: Boolean,
        default: false
      },
      nav: {
        type: Boolean,
        default: true
      },
      chill: {
        type: Boolean,
        default: false
      }
    },
    data() {
      return {
        has_upload: false
      }
    },
    methods: {
      avatar_click(event) {
        if (this.chill) {
          return
        }
        let route = {
          path: `/+1${this.person.mobile}`
        }
        if (this.previous) {
          route.path = sessionStorage.previous
        }
        if (this.me) {
          route.path = '/account'
        }
        if (this.edit_avatar) {
          route.path = '/upload'
        }
        this.$router.push(route)
      }
    },
    computed: {
      avatar() {
        console.log('computing avatar location')
        if (this.person.avatar) {
          return '#avatar'
        }
        // return '#avatar'
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
