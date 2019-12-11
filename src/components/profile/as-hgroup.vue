<template lang="html">
  <hgroup itemscope itemtype='/person' :itemid="item_id">
    <link itemprop="avatar" rel="icon" :href="person.avatar">
    <span itemprop="first_name">{{person.first_name}}</span>
    <span itemprop="last_name">{{person.last_name}}</span>
  </hgroup>
</template>
<script>
  import profile from '@/helpers/profile'
  export default {
    props: ['person'],
    computed: {
      item_id() {
        if (this.person.mobile) {
          return profile.from_phone_number(this.person.mobile)
        } else {
          return this.person.id
        }
      }
    }
  }
</script>
