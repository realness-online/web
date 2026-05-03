<script setup>
  import { watch, onBeforeUnmount } from 'vue'

  const props = defineProps({
    open: {
      type: Boolean,
      default: false
    }
  })

  const emit = defineEmits(['close'])

  defineOptions({
    name: 'AsAsideAccount'
  })

  const on_backdrop = () => emit('close')

  /** @param {KeyboardEvent} e */
  const on_keydown = e => {
    if (e.key === 'Escape' && props.open) {
      e.preventDefault()
      emit('close')
    }
  }

  watch(
    () => props.open,
    open => {
      if (typeof document === 'undefined') return
      if (open) document.addEventListener('keydown', on_keydown, true)
      else document.removeEventListener('keydown', on_keydown, true)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    if (typeof document === 'undefined') return
    document.removeEventListener('keydown', on_keydown, true)
  })
</script>

<template>
  <teleport to="body">
    <div v-if="open" class="as-aside-account" role="presentation">
      <div aria-hidden="true" @click="on_backdrop" />
      <aside role="dialog" aria-modal="true" @click.stop>
        <slot />
      </aside>
    </div>
  </teleport>
</template>

<style lang="stylus">
  /* Unscoped: slot content (e.g. footer) is authored in the parent; one root class limits reach. */
  .as-aside-account {
    position: fixed
    inset: 0
    z-index: 8
    pointer-events: none
    & > div,
    & > aside {
      pointer-events: auto
    }
    & > div {
      position: absolute
      inset: 0
      background-color: black-transparent
    }
    & > aside {
      position: absolute
      top: 0
      left: 50%
      transform: translateX(-50%) translateY(0)
      width: calc(100% - (base-line * 2))
      max-width: page-width
      max-height: min(90vh, round(base-line * 28, 2))
      overflow-y: auto
      padding: base-line
      padding-top: round(base-line * 1.25, 2)
      border-radius: 0 0 (base-line * 0.5) (base-line * 0.5)
      background: white-background
      color: black
      box-shadow:
        0 0.35em 1.2em black-barely,
        0 0.2em 0.5em hsla(228, 9.8%, 6%, 0.15)
      -webkit-overflow-scrolling: touch
      @media (prefers-color-scheme: dark) {
        background: hsla(228, 9.8%, 12%, 0.97)
        color: white-text
        box-shadow:
          0 0.4em 1.4em hsla(0, 0%, 0%, 0.45),
          0 0.15em 0.45em hsla(0, 0%, 0%, 0.35)
      }
      @media (min-width: page-width-large) {
        max-width: page-width-large
      }
      & > footer {
        display: flex
        flex-direction: column
        align-items: flex-start
        gap: base-line * 0.5
        width: 100%
        min-width: 0
        & > a:has(> time) {
          pointer-events: auto
          text-decoration: none
          &:hover > time,
          &:focus-visible > time {
            text-decoration: underline
          }
        }
        & > a > time,
        & > time {
          color: blue
          white-space: nowrap
          padding: base-line * 0.2 base-line * 0.4
          border-radius: base-line * 0.25
          background: black-transparent
          standard-shadow: boop
        }
      }
    }
  }
</style>
