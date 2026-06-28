<script setup>
  import LogoAsLink from '@/components/logo-as-link'
  import { computed } from 'vue'
  import { current_user, me } from '@/utils/serverless'

  // /account shows the sign-in flow when signed out and details when signed in,
  // so one link serves both — the label is what changes.
  const account_label = computed(() => {
    if (me.value?.name) return me.value.name
    if (current_user.value) return 'Account'
    return 'Sign in'
  })
</script>

<template>
  <nav itemscope itemtype="/site-nav" aria-label="Site">
    <logo-as-link />
    <menu>
      <router-link to="/about">About</router-link>
      <router-link to="/docs">Docs</router-link>
      <router-link to="/pricing">Pricing</router-link>
      <router-link to="/account">{{ account_label }}</router-link>
    </menu>
  </nav>
</template>

<style lang="stylus">
  nav[itemtype='/site-nav'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: base-line;
    padding: base-line
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
