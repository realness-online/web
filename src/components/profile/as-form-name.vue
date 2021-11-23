<template>
  <form id="profile-name">
    <fieldset id="name">
      <legend :class="{ valid: is_valid }">Name</legend>
      <input
        id="first-name"
        v-model="first_name"
        type="text"
        placeholder="First"
        @keyup="modified_check" />
      <input
        id="last-name"
        v-model="last_name"
        type="text"
        placeholder="Last"
        @keyup="modified_check" />
    </fieldset>
    <menu>
      <button ref="button" disabled @click.prevent="valid">
        Yep, That's my name
      </button>
    </menu>
  </form>
</template>
<script>
  export default {
    props: {
      person: {
        type: Object,
        required: true
      }
    },
    emits: ['valid', 'update:person'],
    data() {
      return {
        first_name: this.person.first_name,
        last_name: this.person.last_name
      }
    },
    computed: {
      is_valid() {
        let length = 0
        if (this.person.first_name) length = this.person.first_name.length
        else return false // first name is required

        if (this.person.last_name) length += this.person.last_name.length
        else return false // last name is required

        if (length > 2) return true
        else return false // full name is at least 3 characters
      }
    },
    watch: {
      person() {
        this.first_name = this.person.first_name
        this.last_name = this.person.last_name
      }
    },
    methods: {
      async valid() {
        if (this.is_valid) this.$emit('valid')
      },
      async modified_check() {
        let modified = false
        if (this.is_valid) this.$refs.button.disabled = false
        else this.$refs.button.disabled = true
        const updated = { ...this.person }
        if (this.person.first_name !== this.first_name) {
          updated.first_name = this.first_name
          modified = true
        }
        if (this.person.last_name !== this.last_name) {
          updated.last_name = this.last_name
          modified = true
        }
        if (modified) {
          this.$emit('update:person', updated)
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
