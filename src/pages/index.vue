<template>
  <section id="home" v-bind:class="slide_direction" class="page">
    <main-nav></main-nav>
    <aside>
      <post-index></post-index>
      <activity-index></activity-index>
    </aside>
  </section>
</template>

<script>
  import main_nav from '@/components/main-nav'
  import post_index from '@/components/posts/as-list'
  import activity_index from '@/components/activity/as-list'
  export default {
    components: {
      'main-nav': main_nav,
      'activity-index': activity_index,
      'post-index': post_index
    },
    computed: {
      slide_direction() {
        return {
          left: ['/relations', '/profile'].includes(sessionStorage.previous)
        }
      }
    }
  }
</script>
