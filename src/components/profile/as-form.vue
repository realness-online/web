<template lang="html">
  <form id="profile-form">
    <fieldset id="name">
      <input id="first-name" type='text' placeholder="First"
             v-model="person.first_name"
             v-on:blur="save_person">
      <input id="last-name" type='text' placeholder="Last"
             v-model="person.last_name"
             v-on:blur="save_person">
    </fieldset>
    <fieldset>
      <label for="mobile">1+</label>
      <input id="mobile" type="tel" placeholder="(555) 555-5555"
             v-model="person.mobile"
             v-on:keypress="validate_mobile_keypress"
             v-on:paste="validate_mobile_paste"
             v-on:blur="save_person">
      <button class="green">Sync</button>
    </fieldset>
  </form>
</template>

<script>
  import {person_storage} from '@/modules/Storage'
  const valid_mobile = /^[0-9]+$/
  export default {
    props: ['person'],
    data() {
      return {
        storage: person_storage
      }
    },
    methods: {
      save_person() {
        this.storage.save()
      },
      validate_mobile_keypress(event) {
        if (!event.key.match(valid_mobile)) {
          event.preventDefault()
        }
      },
      validate_mobile_paste(event) {
        let paste = (event.clipboardData).getData('text')
        if (!paste.match(valid_mobile)) { event.preventDefault() }
      }
    }
  }
</script>

<style lang="stylus">
  @require '../../style/variables'
  form#profile-form
    & > fieldset
      padding: (base-line / 2 )
      border:0.66vmin solid black
      margin-bottom: base-line
      &:last-of-type
        margin-bottom:0
    input
      color: red
      &:focus
        outline:0
        &::placeholder
          color:lighten(black, 30%)
      &::placeholder
        color: orange
    label[for=mobile]
      margin-right:-0.3em
    input#first-name
      width:40%
      margin-right:base-line
    input#last-name
      width:40%
    input#mobile
      width: (base-line * 6 )
      margin-right: base-line
    button
      padding: (base-line / 11) (base-line / 2 )
</style>
