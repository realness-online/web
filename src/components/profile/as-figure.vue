<template>
  <figure id="profile" itemscope itemtype='/profile'>
    <img  itemprop="profile_vector" :src="person.profile_vector">
    <figcaption>
      <a itemprop="url" :href="person.profile_name">
        <span itemprop="first_name">{{person.first_name}}</span>
        <span itemprop="last_name">{{person.last_name}}</span>
      </a>
      <a :href="person.profile_name">@{{person.profile_name}}</a>
    </figcaption>
  </figure>
</template>

<script>
  export default {
    props: ['person']
  }
</script>

<style lang="stylus">
  @require '../../style/variables'
  figure#profile
    margin:base-line 0
    display:flex
    & > img
      vertical-align: middle
      height: (2 * base-line)
      width: (2 * base-line)
      margin-right: (base-line / 2)
      background-color:black
      border-radius: base-line
    & > figcaption
      vertical-align: middle
      line-height: (base-line * 2)
      & > a
        display:block

</style>
