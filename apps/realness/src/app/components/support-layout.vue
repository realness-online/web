<script setup>
  import SiteNav from '@/components/site-nav'
  import AsWorkspace from '@/components/chat/as-workspace.vue'
  import { use_home_view } from '@/use/home-view'
  import { useRoute as use_route } from 'vue-router'
  const route = use_route()
  const { shows } = use_home_view()
</script>

<template>
  <section
    aria-label="Current page"
    tabindex="-1"
    :inert="!shows.thoughts || undefined">
    <site-nav v-if="route.meta.support" />
    <router-view />
  </section>
  <as-workspace />
</template>

<style lang="stylus">
  section[aria-label='Current page'] {
    inline-size: 100%;
    min-inline-size: 0;
    &:focus-visible {
      outline: none;
    }
    @media (min-width: display-begins) {
      &:not(:has(section#thoughts)):has(~ aside#chat-panel[data-open]:not([data-alone])) {
        padding-inline-start: page-width;
      }
    }
  }
  :root:has(section[aria-label='Current page'][inert]) {
    overflow: hidden;
    & footer[data-footer-visible] {
      visibility: hidden;
    }
  }
</style>
