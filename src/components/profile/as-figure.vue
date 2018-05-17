<template>
  <figure id="profile" itemscope itemtype='/person'>
    <svg itemprop="profile_vector" :src="person.profile_vector" >
      <use xlink:href="/static/icons.svg#silhouette"/>
    </svg>
    <figcaption>
      <p>
        <span itemprop="first_name">{{person.first_name}}</span>
        <span itemprop="last_name">{{person.last_name}}</span>
      </p>
      <a itemprop="mobile" :data-value="person.mobile" :href="mobile_link">{{formated_mobile}}</a>
    </figcaption>
  </figure>
</template>

<script>
  import { AsYouType } from 'libphonenumber-js'
  export default {
    props: ['person'],
    computed: {
      mobile_link() {
        return !!this.person.mobile && `sms:+1${this.person.mobile}`
      },
      formated_mobile() {
        return new AsYouType('US').input(this.person.mobile)
      }
    }
  }
</script>

<style lang="stylus">
  @require '../../style/variables'
  figure#profile
    margin:base-line 0
    display:flex
    & > svg
      border: 0.44vmin solid currentColor
      border-radius: (base-line / 3)
      outline:none
      padding:0
      vertical-align: middle
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
