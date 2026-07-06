<script setup>
  import { ref } from 'vue'

  // eslint-disable-next-line no-undef -- Vue 3.4+ compiler macro available in <script setup>
  const only_mine = defineModel({ type: Boolean, default: false })
  /** @type {import('vue').Ref<null | 'enter' | 'leave'>} */
  const phonebook_motion = ref(null)

  const ANIM_MS = 600
  /** @type {ReturnType<typeof setTimeout> | null} */
  let motion_timer = null

  const silhouette_path =
    'M11.186 3.82a2.582 2.582 0 0 0-.037-.566C10.82 1.34 9.971 0 7.953 0 5.936 0 5.087 1.34 4.757 3.254a2.575 2.575 0 0 0-.037.565c.076 1.524.764 2.961 1.952 3.812.76.543 1.803.543 2.562 0 1.188-.85 1.876-2.288 1.952-3.812Zm4.373 8.883c.415.714.577 1.534.577 2.307H0c0-.773.146-1.593.56-2.307.366-.63 1.734-1.594 2.578-2.188l.307-.218c.766-.547 1.307-.76 2.308-1.056.566-.167.864-.062 1.213.06.267.095.564.2 1.034.2.465 0 .782-.103 1.072-.196.386-.124.724-.233 1.296-.064 1 .296 1.541.51 2.307 1.056l.307.218c.844.594 2.212 1.557 2.577 2.188Z'

  /** @param {'enter' | 'leave'} mode */
  const start_motion = mode => {
    phonebook_motion.value = mode
    if (motion_timer) clearTimeout(motion_timer)
    motion_timer = setTimeout(() => {
      phonebook_motion.value = null
      motion_timer = null
    }, ANIM_MS)
  }

  const toggle = () => {
    if (only_mine.value) {
      only_mine.value = false
      start_motion('enter')
      return
    }
    only_mine.value = true
    start_motion('leave')
  }
</script>

<template>
  <button
    type="button"
    role="switch"
    itemprop="feed_filter"
    :aria-checked="only_mine"
    :data-enter="phonebook_motion === 'enter' ? 'phonebook' : null"
    :data-leave="phonebook_motion === 'leave' ? 'phonebook' : null"
    aria-label="Toggle unshortened feed"
    title="Unshortened"
    @click="toggle">
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <g itemprop="followed_person">
        <path fill-rule="evenodd" :d="silhouette_path" clip-rule="evenodd" />
      </g>
      <g itemprop="followed_person">
        <path fill-rule="evenodd" :d="silhouette_path" clip-rule="evenodd" />
      </g>
      <g itemprop="author">
        <path fill-rule="evenodd" :d="silhouette_path" clip-rule="evenodd" />
      </g>
    </svg>
  </button>
</template>

<style lang="stylus">
  @keyframes feed-silhouette-enter-left {
    from {
      transform: translate(-12%, -40%) scale(0.82);
      opacity: 0;
    }
    to {
      transform: translate(-28%, 5%) scale(1);
      opacity: 0.72;
    }
  }

  @keyframes feed-silhouette-enter-right {
    from {
      transform: translate(12%, -40%) scale(0.82);
      opacity: 0;
    }
    to {
      transform: translate(28%, 5%) scale(1);
      opacity: 0.72;
    }
  }

  feed-silhouette-slide() {
    transition: none;
    animation-duration: 0.55s;
    animation-timing-function: cubic-bezier(0.34, 1.45, 0.64, 1);
    animation-fill-mode: both;
    @media (prefers-reduced-motion: reduce) {
      animation-duration: 0.01ms;
    }
  }

  button[itemprop='feed_filter'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--emphasis);
    cursor: pointer;
    transition: color 0.4s ease;
    -webkit-tap-highlight-color: transparent;
    &:focus {
      outline: none;
    }
    focus-ring();
    &[aria-checked='true'] {
      color: var(--accent);
    }
    @media (hover: hover) and (pointer: fine) {
      &:hover {
        opacity: 0.85;
      }
    }
    &:active {
      transform: scale(0.95);
    }
    & > svg {
      width: base-line * 1.25;
      height: base-line * 1.25;
      overflow: visible;
      & > g path {
        fill: currentColor;
      }
      & > g {
        transform-box: fill-box;
        transform-origin: center bottom;
      }
      & > g:nth-child(1) {
        transform: translate(-28%, 5%);
        opacity: 0.72;
      }
      & > g:nth-child(2) {
        transform: translate(28%, 5%);
        opacity: 0.72;
      }
      & > g:nth-child(3) {
        transform: translate(0, 0);
      }
    }
    &[data-enter='phonebook']:not([aria-checked='true']) > svg {
      & > g:nth-child(1),
      & > g:nth-child(2) {
        feed-silhouette-slide();
      }
      & > g:nth-child(1) {
        animation-name: feed-silhouette-enter-left;
      }
      & > g:nth-child(2) {
        animation-name: feed-silhouette-enter-right;
        animation-delay: 0.04s;
      }
    }
    &[data-leave='phonebook'][aria-checked='true'] > svg {
      & > g:nth-child(1),
      & > g:nth-child(2) {
        feed-silhouette-slide();
        animation-direction: reverse;
      }
      & > g:nth-child(1) {
        animation-name: feed-silhouette-enter-left;
      }
      & > g:nth-child(2) {
        animation-name: feed-silhouette-enter-right;
        animation-delay: 0.04s;
      }
    }
    &[aria-checked='true']:not([data-leave='phonebook']) > svg {
      & > g:nth-child(1) {
        transform: translate(-12%, -40%) scale(0.82);
        opacity: 0;
      }
      & > g:nth-child(2) {
        transform: translate(12%, -40%) scale(0.82);
        opacity: 0;
      }
    }
  }
</style>
