<template lang="html">
  <hgroup itemscope :itemid="item_id">
    <b v-if="editable"
       ref="first_name"
       contenteditable="true"
       itemprop="first_name">{{ person.first_name }}</b>
    <span v-else itemprop="first_name">{{ person.first_name }}</span>
    <b v-if="editable"
       ref="last_name"
       contenteditable="true"
       itemprop="last_name"
       @blur="save_last_name">{{ person.last_name }}</b>
    <span v-else itemprop="last_name">{{ person.last_name }}</span>
    <link itemprop="avatar" rel="icon" :href="person.avatar">
  </hgroup>
</template>
<script>
  import { Me } from '@/persistance/Storage'
  import profile from '@/helpers/profile'
  export default {
    props: {
      person: {
        type: Object,
        required: true
      }
    },
    data () {
      return {
        editable: false
      }
    },
    computed: {
      item_id () {
        if (this.person.mobile) {
          return profile.from_phone_number(this.person.mobile)
        } else {
          return this.person.id
        }
      }
    },
    created () {
      if (this.me === this.person.id) this.editable = true
    },
    methods: {
      async save_last_name (event) {
        const possibly_changed = this.$refs.last_name.textContent.trim()
        if (this.person.last_name !== possibly_changed) {
          this.editable = false
          await this.$forceUpdate()
          await new Me().save()
          this.editable = true
        }
      }
    }
  }
</script>
<style lang="stylus">

  hgroup[itemscope]
    color: black
    margin:0
    @media (prefers-color-scheme: dark)
      color: white
    & > b:first-of-type
    & > span:first-of-type
      margin-right: (base-line / 4)
    & > span
      text-transform: capitalize
    & > b[itemprop]
      font-weight: 400
      &:focus
        font-weight: 700
        outline: 0
</style>
