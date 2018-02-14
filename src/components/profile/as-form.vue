<template lang="html">
  <form id="profile-form">
    <fieldset id="profile-name">
      <input type='text' id="first-name" v-model="person.first_name" placeholder="First name">
      <input type='text' id="last-name"  v-model="person.last_name" placeholder="Last name">
    </fieldset>
    <fieldset id="profile-url">
      <label for="url">/</label>
      <input id='url' type="url" v-model="person.profile_name" placeholder="profile-name">
    </fieldset>
    <button class="red">Close</button>
  </form>
</template>

<script>
  export default {
    props: ['person']
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
    label[for=url]
      margin-right:-0.3em
    input[type=text]
      display:block
      &:first-of-type
        margin-bottom: (base-line / 2 )
    button
      margin-top:base-line
      width:25vw
      padding: (base-line / 2 )
</style>
