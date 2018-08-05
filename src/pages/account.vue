<template lang="html">
  <section id="account" class="page left">
    <header>
      <profile-as-figure :person='person' :nav="false"></profile-as-figure>
      <router-link to="/profile">
        <icon name="finished"></icon>
      </router-link>
    </header>
    <profile-as-form :person='person'></profile-as-form>
  </section>
</template>
<script>
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
        person: person_storage.as_object()
      }
    }
  }
</script>
<style lang='stylus'>
  @require '../style/variables'
  section#account header
    margin-bottom: base-line
    figure.profile  svg
      color:black
      standard-border(black)
</style>
