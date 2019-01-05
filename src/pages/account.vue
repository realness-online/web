<template lang="html">
  <section id="account" class="page left">
    <header>
      <profile-as-figure v-if="signed_in" :person="person" :view_avatar="false" ></profile-as-figure>
      <svg v-else> </svg>
      <router-link to="/profile">
        <icon name="finished"></icon>
      </router-link>
    </header>
    <profile-as-form :person='person'></profile-as-form>
  </section>
</template>
<script>
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
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
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
  section#account header
    margin-bottom: base-line
</style>
