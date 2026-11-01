<script setup>
  import LogoAsLink from '@/components/logo-as-link'
  import AsChatToggle from '@/components/chat/as-chat-toggle.vue'
  import Icon from '@/components/icon.vue'
  import {
    computed,
    onMounted as mounted,
    onUnmounted as unmounted,
    ref,
    watch
  } from 'vue'
  import { useRoute as use_route } from 'vue-router'
  import { current_user, me } from '@/utils/serverless'

  const route = use_route()
  const pricing_current = computed(() => route?.path?.startsWith('/pricing/'))
  const account_label = computed(
    () => (current_user.value && me.value?.name) || 'Account'
  )

  const NARROW = '(max-width: 40rem)'
  const narrow = () =>
    typeof matchMedia === 'function' && matchMedia(NARROW).matches
  /** Open on wide screens so the full list reads inline; closed on narrow. */
  const more_open = ref(typeof matchMedia === 'function' ? !narrow() : true)
  const sync_more = () => {
    more_open.value = !narrow()
  }
  mounted(() => matchMedia(NARROW)?.addEventListener('change', sync_more))
  unmounted(() => matchMedia(NARROW)?.removeEventListener('change', sync_more))
  watch(
    () => route?.fullPath,
    () => {
      if (narrow()) more_open.value = false
    }
  )
</script>

<template>
  <nav
    itemscope
    itemtype="https://schema.org/SiteNavigationElement"
    aria-label="Site">
    <as-chat-toggle v-if="current_user" />
    <menu data-primary>
      <router-link to="/about" replace>About</router-link>
      <router-link to="/docs" replace>Docs</router-link>
    </menu>
    <details
      data-nav-more
      :open="more_open"
      @toggle="more_open = $event.target.open">
      <summary aria-label="More">...</summary>
      <menu>
        <router-link
          to="/pricing"
          replace
          :aria-current="pricing_current ? 'page' : undefined"
          >Pricing</router-link
        >
        <router-link to="/prints" replace>Prints</router-link>
        <router-link to="/terms" replace>Legal</router-link>
      </menu>
    </details>
    <span data-identity>
      <router-link
        id="account"
        to="/account"
        replace
        :aria-label="account_label"
        :title="account_label">
        <icon name="silhouette" />
      </router-link>
      <logo-as-link />
    </span>
  </nav>
</template>

<style>
  nav[itemtype$='/SiteNavigationElement'] {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--base-line);
    padding: var(--base-line);
    padding-top: calc(env(safe-area-inset-top, 0px) + var(--base-line));

    menu {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: calc(var(--base-line) * 0.5) var(--base-line);
      list-style: none;
    }

    span[data-identity] {
      display: inline-flex;
      align-items: center;
      gap: calc(var(--base-line) * 0.5);
    }

    details[data-nav-more] {
      flex: 0 0 auto;

      summary {
        display: none;
      }

      menu {
        display: flex;
      }
    }

    a {
      color: var(--accent);
      text-decoration: none;

      &:hover {
        color: var(--emphasis);
      }

      &.router-link-active,
      &[aria-current='page'] {
        color: var(--emphasis);
      }
    }

    & > span[data-identity] > a#account {
      display: inline-flex;
      & > svg {
        width: calc(var(--base-line) * 1.33);
        height: calc(var(--base-line) * 1.33);
        fill: currentColor;
      }
    }
  }

  @media (max-width: 40rem) {
    nav[itemtype$='/SiteNavigationElement'] {
      gap: calc(var(--base-line) * 0.5);

      menu {
        flex: 0 0 auto;
        gap: calc(var(--base-line) * 0.5);
      }

      details[data-nav-more] {
        position: relative;

        summary {
          display: inline-flex;
          cursor: pointer;
          color: var(--accent);
          list-style: none;
          &::-webkit-details-marker {
            display: none;
          }
        }

        &:not([open]) menu {
          display: none;
        }

        menu {
          position: absolute;
          inset-block-start: calc(100% + (var(--base-line) * 0.5));
          inset-inline-start: 0;
          flex-direction: column;
          align-items: flex-start;
          gap: calc(var(--base-line) * 0.5);
          min-inline-size: calc(var(--base-line) * 6);
          padding: var(--base-line);
          border: round(var(--base-line) * 0.1, 2) solid var(--emphasis);
          border-radius: calc(var(--base-line) * 0.5);
          background: var(--surface);
          z-index: 12;
        }
      }
    }
  }
</style>
