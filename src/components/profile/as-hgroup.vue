<template lang="html">
  <hgroup itemscope :itemid="person.id">
    <b v-if="editable"
       ref="first_name"
       :key="person.first_name"
       contenteditable="true"
       itemprop="first_name"
       @blur="save_first_name">{{ person.first_name }}</b>
    <span v-else itemprop="first_name">{{ person.first_name }}</span>
    <b v-if="editable"
       ref="last_name"
       :key="person.last_name"
       contenteditable="true"
       itemprop="last_name"
       @blur="save_last_name">{{ person.last_name }}</b>
    <span v-else itemprop="last_name">{{ person.last_name }}</span>
    <link :key="person.avatar" itemprop="avatar" rel="icon" :href="person.avatar">
    <meta v-if="person.mobile" itemprop="mobile" :content="person.mobile">
  </hgroup>
</template>
<script>
  import { Me } from '@/persistance/Storage'
  export default {
    props: {
      person: {
        type: Object,
        required: true
      },
      editable: {
        type: Boolean,
        required: false,
        default: false
      }
    },
    data () {
      return {
        saving: false
      }
    },
    computed: {
      is_me () { return localStorage.me === this.person.id }
    },
    methods: {
      async save_first_name (event) {
        const possibly_changed = this.$refs.first_name.textContent.trim()
        if (this.person.first_name !== possibly_changed) {
          this.editable = false
          this.person.first_name = possibly_changed
          await this.$nextTick()
          await new Me().save()
          this.editable = true
        }
      },
      async save_last_name (event) {
        const possibly_changed = this.$refs.last_name.textContent.trim()
        if (this.person.last_name !== possibly_changed) {
          this.editable = false
          this.person.last_name = possibly_changed
          await this.$nextTick()
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
