<template lang="html">
  <transition name="fade">
    <form id="profile-form">
      <fieldset>
        <input id="first-name" type='text' placeholder="First name"
               v-model="person.first_name"
               v-on:blur="save_person"
               debounce="500">
        <input id="last-name" type='text' placeholder="Last name"
               v-model="person.last_name"
               v-on:blur="save_person"
               debounce="500">
      </fieldset>
      <fieldset>
        <label for="profile-name">/</label>
        <input id='profile-name' type="text" placeholder="profile-name"
               v-model="person.profile_name"
               v-on:blur="save_person"
               debounce="500">
      </fieldset>
    </form>
  </transition>
</template>

<script>
  import {person_storage} from '@/modules/Storage'
  export default {
    props: ['person'],
    methods: {
      save_person: function() {
        person_storage.save()
      }
    }
  }
</script>

<style lang="stylus">
  @require '../../style/variables'
  form#profile-form
    & > fieldset
      padding: base-line
      border:0.37vmin solid black
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
      margin-right:-0.3em
    input#first-name
      display:block
      margin-bottom: (base-line / 2 )
    button
      margin-top:base-line
      width:25vw
      padding: (base-line / 2 )
</style>
