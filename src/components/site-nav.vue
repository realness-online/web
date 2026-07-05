<script setup>
  import LogoAsLink from '@/components/logo-as-link'
  import { computed } from 'vue'
  import { current_user, me } from '@/utils/serverless'

  // /account shows the sign-in flow when signed out and details when signed in,
  // so one link serves both — the label is what changes.
  // Only show the name when actually authenticated — a cached `me.name` while
  // signed out would falsely imply you're signed in.
  const account_label = computed(() => {
    if (!current_user.value) return 'Sign in'
    return me.value?.name || 'Account'
  })
</script>

<template>
  <nav itemscope itemtype="/site-nav" aria-label="Site">
    <logo-as-link />
    <menu>
      <router-link to="/about" replace>About</router-link>
      <router-link to="/docs" replace>Docs</router-link>
      <router-link to="/pricing" replace>Pricing</router-link>
      <router-link to="/account" replace>{{ account_label }}</router-link>
    </menu>
  </nav>
</template>

<style lang="stylus">
  nav[itemtype='/site-nav'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: base-line;
    padding: base-line;
    padding-top: s('calc(env(safe-area-inset-top, 0px) + %s)', base-line);

    menu {
      flex: 1;
      display: flex;
      align-items: center;
      gap: base-line;
      margin: 0;
      padding: 0;
      list-style: none;

      a {
        color: var(--accent);
        text-decoration: none;

        &:hover {
          color: var(--emphasis);
        }

        &.router-link-active {
          color: var(--emphasis);
        }
      }

      // The account link anchors to the far right, using the remaining space.
      & > a:last-child {
        margin-left: auto;
        text-align: right;
      }
    }
  }
</style>
