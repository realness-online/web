<template lang="html">
  <section id="profile" >
    <header>
      <a id="logo" href="/">
        <img src="/static/icons/logo.svg" alt="">
      </a>
      <details>
        <summary><profile-as-figure :person='person'></profile-as-figure></summary>
        <profile-as-form :person='person'></profile-as-form>
      </details>
    </header>
    <h4>Posts</h4>
    <posts-list></posts-list>
  </section>
</template>

<script>
  import '@/modules/timeago'
  import as_figure from '@/components/profile/as-figure'
  import as_form from '@/components/profile/as-form'
  import posts_list from '@/components/posts-list'
  import activity_list from '@/components/activity-list'
  import {person_storage} from '@/modules/Storage'

  export default {
    components: {
      'profile-as-figure': as_figure,
      'profile-as-form': as_form,
      'posts-list': posts_list,
      'activity-list': activity_list
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
  section#profile > header > details
    margin-right: base-line * 2
    &[open]
      margin-right: inherit;
  #logo
    position:fixed
    top: -(2 * base-line)
    right: 0
    padding:base-line
    & >  img
      margin-top:base-line
      width:(base-line)
      height:(base-line)
  section#profile
    position: relative
    padding: 0 base-line
    & > header
      margin-bottom: base-line
</style>
