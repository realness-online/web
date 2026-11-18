<template>
  <header>
    <hgroup>
      <h1>
        <router-link to="/blog">{{ site.name }}</router-link>
      </h1>
      <p>{{ site.tagline }}</p>
    </hgroup>
    <nav>
      <router-link to="/blog">Thoughts</router-link>
    </nav>
  </header>
</template>

<script setup>
  import site from '../../../../blog/site.json'
</script>

<style lang="stylus">
  main[data-blog] nav[aria-label='Site'] {
    display: none;
  }
</style>
