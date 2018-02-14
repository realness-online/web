<template lang="html">
  <section id="profile">
    <header>
      <profile-as-figure :person='person'></profile-as-figure>
      <details>
        <summary>Edit</summary>
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
        person: person_storage.get_items()
      }
    }
  }
</script>
<style lang='stylus'>
  @require '/style/variables'
  section#profile
    position: relative
    padding: 0 base-line
    & > header
      margin-bottom: base-line
      & > details
        position: absolute;
        top: (base-line - 1.5 )
        right:base-line
        &[open]
          position: static
          summary
            display: none
        summary
          padding: base-line 0
    & > details > summary
      color:black
      margin-bottom: (base-line / 2 )
</style>
