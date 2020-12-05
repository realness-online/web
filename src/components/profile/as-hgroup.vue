<template lang="html">
  <hgroup itemscope :itemid="person.id">
    <b v-if="editable"
       ref="first_name"
       :key="person.first_name"
       contenteditable="true"
       itemprop="first_name"
       @blur="save_first_name">{{ person.first_name }}</b>
    <p v-else itemprop="first_name">{{ person.first_name }}</p>
    <b v-if="editable"
       ref="last_name"
       :key="person.last_name"
       contenteditable="true"
       itemprop="last_name"
       @blur="save_last_name">{{ person.last_name }}</b>
    <p v-else itemprop="last_name">{{ person.last_name }}</p>
    <link :key="person.avatar" itemprop="avatar" rel="icon" :href="person.avatar">
    <meta v-if="person.mobile" itemprop="mobile" :content="person.mobile">
    <meta v-if="person.visited" itemprop="visited" :content="person.visited">
  </hgroup>
</template>
<script>
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
    methods: {
      async save_first_name (event) {
        const possibly_changed = this.$refs.first_name.textContent.trim()
        if (this.person.first_name !== possibly_changed) {
          const updated = { ...this.person }
          updated.first_name = possibly_changed
          this.$emit('update:person', updated)
        }
      },
      async save_last_name (event) {
        const possibly_changed = this.$refs.last_name.textContent.trim()
        if (this.person.last_name !== possibly_changed) {
          const updated = { ...this.person }
          updated.last_name = possibly_changed
          this.$emit('update:person', updated)
        }
      }
    }
  }
</script>
<style lang="stylus">
  hgroup[itemscope]
    color: black
    margin: 0
    padding: 0
    @media (prefers-color-scheme: dark)
      color: white
    & > p,
    & > b
      text-align: left
    & > p
      margin: 0
      text-transform: capitalize
      &:first-of-type
        margin-bottom: (base-line / 3)
    & > b[itemprop]
      margin-left: (base-line / 3)
      line-height: 1
      display: block
      font-weight: 400
      &:first-of-type
        margin-bottom: (base-line )
      &:focus
        font-weight: 700
        outline: 0
</style>
