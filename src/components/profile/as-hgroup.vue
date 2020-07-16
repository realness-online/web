<template lang="html">
  <hgroup itemscope :itemid="item_id">
    <span v-if="editable"
          ref="first_name"
          contenteditable="true"
          itemprop="first_name">{{ person.first_name }}</span>
    <span v-else itemprop="first_name">{{ person.first_name }}</span>
    <span v-if="editable"
          ref="last_name"
          contenteditable="true"
          itemprop="last_name"
          @blur="save_last_name">{{ person.last_name }}</span>
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
