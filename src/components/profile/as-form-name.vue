<template>
  <form id="profile-form">
    <fieldset id="name">
      <legend>Name</legend>
      <input id="first-name" v-model="person.first_name"
             type="text"
             tabindex="1"
             placeholder="First"
             required
             @blur="modified_check">
      <input id="last-name" v-model="person.last_name"
             type="text"
             tabindex="2"
             placeholder="Last"
             required
             @blur="modified_check">
    </fieldset>
    <button @click="save">Yep, That's my name</button>
  </form>
</template>
<script>
  import { load } from '@/helpers/itemid'
  import { Me } from '@/persistance/Storage'
  export default {
    props: {
      person: {
        type: Object,
        required: true
      }
    },
    methods: {
      async save () {
        const me = new Me()
        await me.save()
      },
      async modified_check () {
        const me = await load(localStorage.me)
        if (!me) {
          this.$emit('modified')
          return
        }
        let modified = false
        if (me.first_name !== this.person.first_name) modified = true
        if (me.last_name !== this.person.last_name) modified = true
        if (modified) this.$emit('modified', this.person)
      }
    }
  }
</script>
