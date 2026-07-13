<script setup>
  import SiteNav from '@/components/site-nav'
  import { useRoute as use_route } from 'vue-router'
  const route = use_route()
</script>

<template>
  <div class="support-layout">
    <site-nav v-if="route.meta.support" />
    <router-view />
  </div>
</template>

<style>
  .support-layout {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
  }
</style>
