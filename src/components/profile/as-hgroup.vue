<template>
  <hgroup itemscope :itemid="person.id">
    <b v-if="editable"
       ref="first_name"
       :key="person.first_name"
       contenteditable="true"
       itemprop="first_name"
       @blur="save_first_name">{{ person.first_name }}</b>
    <h3 v-else itemprop="first_name">{{ person.first_name }}</h3>
    <b v-if="editable"
       ref="last_name"
       :key="person.last_name"
       contenteditable="true"
       itemprop="last_name"
       @blur="save_last_name">{{ person.last_name }}</b>
    <h3 v-else itemprop="last_name">{{ person.last_name }}</h3>
    <slot />
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
    emits: ['update:person'],
    methods: {
      async save_first_name () {
        const possibly_changed = this.$refs.first_name.textContent.trim()
        if (this.person.first_name !== possibly_changed) {
          const updated = { ...this.person }
          updated.first_name = possibly_changed
          this.$emit('update:person', updated)
        }
      },
      async save_last_name () {
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
    & > h3,
    & > b
      text-align: left
    & > h3
      between font-size
      margin: 0
      text-transform: capitalize
      &:first-of-type
        margin-bottom: round((base-line / 6), 2)
    & > b[itemprop]
      line-height: 1
      display: inline-block
      font-weight: 300
      &:first-of-type
        margin-right: round((base-line / 6), 2)
        margin-bottom: round((base-line / 3), 2)
      &:focus
        font-weight: 400
        outline: 0
</style>
