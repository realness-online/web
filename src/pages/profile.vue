<template lang="html">
  <section id="profile" class="page">
    <header>
      <details>
        <summary><profile-as-figure :person='person'></profile-as-figure></summary>
        <profile-as-form :person='person'></profile-as-form>
      </details>
      <logo-as-link></logo-as-link>
    </header>
    <posts-index></posts-index>
  </section>
</template>

<script>
  import '@/modules/timeago'
  import {person_storage} from '@/modules/Storage'
  import as_figure from '@/components/profile/as-figure'
  import as_form from '@/components/profile/as-form'
  import logo_as_link from '@/components/logo-as-link'
  import posts_index from '@/components/posts/as-list'
  export default {
    components: {
      'profile-as-figure': as_figure,
      'profile-as-form': as_form,
      'posts-index': posts_index,
      'logo-as-link': logo_as_link
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
  section#profile header
    figure.profile > a
      color:black
    details[open] ~ a
      position: fixed
      top: base-line
      right: base-line
</style>
