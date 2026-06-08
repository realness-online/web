<script setup>
  import LogoAsLink from '@/components/logo-as-link'
</script>

<template>
  <nav class="marketing-nav" aria-label="Site">
    <logo-as-link />
    <menu>
      <router-link to="/about">About</router-link>
      <router-link to="/docs">Docs</router-link>
      <router-link to="/pricing">Pricing</router-link>
    </menu>
  </nav>
</template>

<style lang="stylus">
  nav.marketing-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: base-line;
    padding: base-line;

    menu {
      display: flex;
      gap: base-line;
      margin: 0;
      padding: 0;
      list-style: none;

      a {
        color: var(--blue);
        text-decoration: none;

        &:hover {
          color: var(--red);
        }

        &.router-link-active {
          color: var(--red);
        }
      }
    }
  }
</style>
