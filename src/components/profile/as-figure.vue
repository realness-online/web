<template>
  <figure id="profile" itemscope itemtype='/person'>
    <img  itemprop="profile_vector" :src="person.profile_vector">
    <figcaption>
      <a itemprop="profile_name" :data-value="person.profile_name" :href="profile_url">
        <span itemprop="first_name">{{person.first_name}}</span>
        <span itemprop="last_name">{{person.last_name}}</span>
      </a>
      <a :href="profile_url">{{prefix_at}}</a>
    </figcaption>
  </figure>
</template>

<script>
  export default {
    props: ['person'],
    computed: {
      prefix_at: function() {
        if (this.person.profile_name && this.person.profile_name.length > 3) {
          return `@${this.person.profile_name}`
        } else {
          return ''
        }
      },
      profile_url: function() {
        return `/${this.person.profile_name}`
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
      margin-right: (base-line / 2)
      border: 1vmin solid black
      border-radius: base-line
    & > figcaption
      vertical-align: middle
      line-height: (base-line * 2)
      & > a
        display:block

</style>
