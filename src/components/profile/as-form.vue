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
    </fieldset>
    <fieldset>
      <label for="profile-name">/</label>
      <input id='profile-name' type="text" placeholder="profile-name"
             v-model="person.profile_name"
             v-on:keypress="validate_profile_name_keypress"
             v-on:paste="validate_profile_name_paste"
             v-on:blur="save_person">
    </fieldset>
  </form>
</template>

<script>
  import {person_storage} from '@/modules/Storage'
  const valid_mobile = /^[0-9]+$/
  const valid_username = /^[0-9a-z\-_]+$/
  export default {
    props: ['person'],
    methods: {
      save_person() {
        person_storage.save()
      },
      validate_profile_name_keypress(event) {
        if (!event.key.match(valid_username)) { event.preventDefault() }
      },
      validate_profile_name_paste(event) {
        let paste = (event.clipboardData || window.clipboardData).getData('text')
        if (!paste.match(valid_mobile)) { event.preventDefault() }
      },
      validate_mobile_keypress(event) {
        if (!event.key.match(valid_mobile)) { event.preventDefault() }
      },
      validate_mobile_paste(event) {
        let paste = (event.clipboardData || window.clipboardData).getData('text')
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
    label[for=profile-name]
    label[for=mobile]
      margin-right:-0.3em
    input#first-name
      width:40%
      margin-right:base-line
    input#last-name
      width:40%
    input#profile-name
      width:auto
</style>
