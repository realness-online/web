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
  const is_home = computed(() => route?.path === '/')
  const account_label = computed(
    () => (current_user.value && me.value?.name) || 'Account'
  )

  const from_blog = ref('')
  if (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('from') === 'blog'
  )
    from_blog.value = document.referrer || history.state?.back || ''

  const version = import.meta.env.PACKAGE_VERSION ?? ''
  const version_parts = version.split('.')

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
    <menu v-if="!is_home" data-primary>
      <router-link to="/about" replace>About</router-link>
      <router-link to="/docs" replace>Docs</router-link>
    </menu>
    <details
      v-if="!is_home"
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
      <a v-if="from_blog" :href="from_blog">←</a>
      <router-link
        v-if="!is_home"
        id="account"
        to="/account"
        replace
        :aria-label="account_label"
        :title="account_label">
        <icon name="silhouette" />
      </router-link>
      <logo-as-link v-if="!is_home" />
      <router-link v-if="is_home" id="about" to="/about" tabindex="-1">
        <span>{{ version_parts[0] }}</span>
        <span>?</span>
        <span>{{ version_parts[1] }}</span>
        <span>{{ version_parts[2] }}</span>
      </router-link>
    </span>
  </nav>
</template>

<style>
  nav[itemtype$='/SiteNavigationElement'] {
    width: 100%;
    box-sizing: border-box;
    block-size: calc(env(safe-area-inset-top, 0px) + var(--header-size));
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
      margin-inline-start: auto;
      gap: var(--base-line);
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

    & > span[data-identity] > a#about {
      font-weight: bold;
      font-size: calc(var(--base-line) * 1.44);
      -webkit-user-select: none;
      user-select: none;
      display: grid;
      grid-template-columns: auto auto auto;
      grid-template-rows: auto auto;
      align-items: baseline;
      & > span {
        font-size: 0.266em;
        vertical-align: sub;
        opacity: 0.67;
        transition-property: opacity, color;
        transition-timing-function: ease;
        transition-duration: 0.66s;
        @media (prefers-reduced-motion: reduce) {
          transition-duration: 0.01ms;
        }
      }
      & > span:first-child {
        grid-column: 1;
        grid-row: 1;
        margin-right: 0.1em;
        margin-left: calc(var(--base-line) * -0.25);
      }
      & > span:nth-child(2) {
        grid-column: 2;
        grid-row: 1;
        font-size: 1em;
        opacity: 1;
        transform: scale(1);
        transition-property: transform, color;
        transition-timing-function: cubic-bezier(0.34, 1.45, 0.64, 1);
        transition-duration: 0.66s;
        @media (prefers-reduced-motion: reduce) {
          transition-duration: 0.01ms;
        }
      }
      & > span:nth-child(3) {
        grid-column: 2;
        grid-row: 2;
        justify-self: center;
        transform: translateY(calc(var(--base-line) * -0.25));
      }
      & > span:last-child {
        grid-column: 3;
        grid-row: 1;
        margin-left: 0.1em;
        margin-right: calc(var(--base-line) * -0.25);
      }
      @media (hover: hover) and (pointer: fine) {
        &:hover {
          color: var(--accent);
          & > span:nth-child(2) {
            color: var(--emphasis);
            transform: scale(1.15);
            @media (prefers-reduced-motion: reduce) {
              transform: scale(1);
            }
          }
          & > span:not(:nth-child(2)) {
            opacity: 0.3;
          }
        }
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
