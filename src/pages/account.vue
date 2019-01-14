<template lang="html">
  <section id="account" v-bind:class="{signed_in}" class="page left">
    <header>
      <profile-as-figure :person="person" :just_display_avatar="true" ></profile-as-figure>
      <router-link to="/profile">
        <icon name="finished"></icon>
      </router-link>
    </header>
    <profile-as-form :person='person'></profile-as-form>
  </section>
</template>
<script>
  import Vue from 'vue'
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import {person_storage} from '@/modules/Storage'
  import as_figure from '@/components/profile/as-figure'
  import as_form from '@/components/profile/as-form'
  import icon from '@/components/icon'
  export default {
    components: {
      'profile-as-figure': as_figure,
      'profile-as-form': as_form,
      icon
    },
    data() {
      return {
        person: person_storage.as_object(),
        signed_in: false
      }
    },
    created() {
      this.$bus.$off('save-me')
      this.$bus.$on('save-me', person => {
        console.log('save-me called')
        firebase.auth().onAuthStateChanged(user => {
          if (user) {
            this.person.mobile = user.phoneNumber.substring(2)
          }
          Vue.nextTick(() => person_storage.save())
        })
      })
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          console.log('signed in')
          this.person.mobile = user.phoneNumber.substring(2)
          this.signed_in = true
        } else {
          this.signed_in = false
        }
      })
    }
  }
</script>
<style lang='stylus'>
  @require '../style/variables'
  section#account.signed_in
    position: relative
    & > header
      margin-bottom: 0
      & > a
        position: absolute
        top: base-line
        right: base-line
      & > figure
        & > figcaption
          display: none
        & > svg
          min-height:75vh
          width:100vw
    form#profile-form
      #name
      #phone
        display:none
      menu
        position: absolute
        top: base-line
  section#account header
    margin-bottom: base-line
</style>
