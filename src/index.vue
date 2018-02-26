<template>
  <section id="app">
    <main-nav></main-nav>
    <aside>
      <activity-list></activity-list>
      <posts-list></posts-list>
      <developer-tools></developer-tools>
    </aside>
  </section>
</template>

<script>
  import main_nav from '@/components/main-nav'
  import posts_list from '@/components/posts-list'
  import activity_list from '@/components/activity-list'
  import developer_tools from '@/components/developer'
  export default {
    components: {
      'main-nav': main_nav,
      'activity-list': activity_list,
      'posts-list': posts_list,
      'developer-tools':developer_tools
    }
  }
</script>
