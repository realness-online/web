<template>
  <figure class="profile" itemscope itemtype='/person'>
    <meta itemprop="created_at" :content="person.created_at">
    <meta itemprop="updated_at" :content="person.updated_at">
    <router-link v-if="nav" :to="profile_link">
      <svg><use itemprop="image" :xlink:href="guaranteed_image"/></svg>
    </router-link>
    <svg v-else><use itemprop="image" :xlink:href="guaranteed_image"/></svg>
    <figcaption>
      <p>
        <span itemprop="first_name">{{person.first_name}}</span>
        <span itemprop="last_name">{{person.last_name}}</span>
      </p>
      <a v-if="nav" itemprop="mobile" :data-value="person.mobile" :href="sms_link">{{mobile_display}}</a>
      <p v-else itemprop="mobile" :data-value="person.mobile">{{mobile_display}}</p>
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
      nav: {
        type: Boolean,
        default: true
      }
    },
    computed: {
      sms_link() {
        return !!this.person.mobile && `sms:+1${this.person.mobile}`
      },
      profile_link() {
        // return !!this.person.mobile && `/+1${this.person.mobile}`
        let route = {
          path: `/+1${this.person.mobile}`
        }
        if (this.previous) {
          route.path = sessionStorage.previous
        }
        if (this.me) {
          route.path = '/account'
        }
        return route
      },
      mobile_display() {
        return new AsYouType('US').input(this.person.mobile)
      },
      guaranteed_image() {
        if (!this.person.image) {
          return `${icons}#silhouette`
        } else {
          return this.person.image
        }
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
    & > a > svg
      fill: black
      standard-border()
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
