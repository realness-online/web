<template>
  <figure class="profile" itemscope itemtype='/person'>
    <a :href="profile_link">
      <svg><use itemprop="image" :xlink:href="guaranteed_image"/></svg>
    </a>
    <figcaption>
      <p>
        <span itemprop="first_name">{{person.first_name}}</span>
        <span itemprop="last_name">{{person.last_name}}</span>
      </p>
      <a itemprop="mobile" :data-value="person.mobile" :href="sms_link">{{mobile_display}}</a>
    </figcaption>
  </figure>
</template>
<script>
  import { AsYouType } from 'libphonenumber-js'
  import icons from '@/icons.svg'
  export default {
    props: ['person'],
    computed: {
      sms_link() {
        return !!this.person.mobile && `sms:+1${this.person.mobile}`
      },
      profile_link() {
        return !!this.person.mobile && `/profiles/${this.person.mobile}`
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
      border: 0.44vmin solid currentColor
      border-radius: (base-line / 3)
      outline:none
      padding:0
      vertical-align: middle
      fill:black
      height: (2 * base-line)
      width: (2 * base-line)
    & > figcaption
      padding-left: (base-line / 2)
      vertical-align: middle
      line-height: (base-line * 2)
      & > p
        margin:0
        & > span
          text-transform: capitalize
      & > a

        display:block
</style>
