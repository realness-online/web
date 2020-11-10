<template>
  <form id="profile-name">
    <fieldset id="name">
      <legend :class="{ valid: is_valid }">Name</legend>
      <input id="first-name" v-model="person.first_name"
             type="text"
             tabindex="1"
             placeholder="First"
             @keyup="validate"
             @blur="modified_check">
      <input id="last-name" v-model="person.last_name"
             type="text"
             tabindex="2"
             placeholder="Last"
             @keyup="validate"
             @blur="modified_check">
    </fieldset>
    <menu>
      <button ref="button"
              disabled tabindex="3"
              @click.prevent="valid">
        Yep, That's my name
      </button>
    </menu>
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
    computed: {
      is_valid () {
        let length = 0
        if (this.person.first_name) length = this.person.first_name.length
        if (this.person.last_name) length += this.person.last_name.length
        if (length > 2) return true
        else return false
      }
    },
    methods: {
      validate () {
        if (this.is_valid) this.$refs.button.disabled = false
        else this.$refs.button.disabled = true
      },
      async valid () {
        if (this.is_valid) {
          this.$emit('validated')
        } else this.$refs.button.disabled = false
      },
      async modified_check () {
        const me = await load(localStorage.me)
        if (!me) {
          const me = new Me()
          await me.save()
          this.$emit('modified')
          return
        }
        if (this.is_valid) this.$refs.button.disabled = false
        let modified = false
        if (me.first_name !== this.person.first_name) modified = true
        if (me.last_name !== this.person.last_name) modified = true
        if (modified) {
          const me = new Me()
          await me.save()
          this.$emit('modified', this.person)
        }
      }
    }
  }
</script>
<style lang="stylus">
  form#profile-name
    animation-name: slide-in-left
    &.complete
      animation-name: slide-out-right
    fieldset
      margin-bottom: base-line
    input#first-name
      width: 40%
      margin-right: base-line
    input#last-name
      width: 40%
    menu
      display: flex
      justify-content: flex-end
</style>
