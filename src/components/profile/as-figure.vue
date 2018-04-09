<template>
  <figure id="profile" itemscope itemtype='/person'>
    <img  itemprop="profile_vector" :src="person.profile_vector">
    <figcaption>
      <p>
        <span itemprop="first_name">{{person.first_name}}</span>
        <span itemprop="last_name">{{person.last_name}}</span>
      </p>
      <a itemprop="profile_name" :data-value="person.profile_name" :href="mobile_link">{{person.mobile}}</a>
    </figcaption>
  </figure>
</template>

<script>
  export default {
    props: ['person'],
    computed: {
      mobile_link: function() {
        return `1+${this.person.mobile}`
      }
    }
  }
</script>

<style lang="stylus">
  @require '../../style/variables'
  figure#profile
    margin:base-line 0
    display:flex
    & > img
      outline:none
      padding:0
      vertical-align: middle
      height: (3 * base-line)
      width: (3 * base-line)
      background-color: black
      border: 0.66vmin solid black
      border-radius: base-line
    & > figcaption
      padding-left: (base-line / 2)
      vertical-align: middle
      line-height: (base-line * 2)
      & > p
        margin:0
      & > a
        display:block

</style>
