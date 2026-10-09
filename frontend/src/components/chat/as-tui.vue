<script setup>
  import { current_user } from '@/utils/serverless'
  import { open_terminal } from '@/utils/brayness-gate'
  import { use_home_view } from '@/use/home-view'
  import {
    nextTick as next_tick,
    onBeforeUnmount as on_before_unmount,
    ref,
    watch
  } from 'vue'
  import wasm_url from '../../../terminal/public/ghostty-vt.wasm?url'

  /* The actor's Pi session as a terminal, through the gate. It connects the
     first time it shows - only on a display-wide screen, so a phone never
     takes the terminal from another tab - and stays connected after. */
  const props = defineProps({
    actor: { type: String, default: null }
  })

  const { view, shows, wide } = use_home_view()
  const pane = ref(null)
  const mounted = ref(false)
  const problem = ref('')
  let terminal = null
  let left = false

  const mount_terminal = async () => {
    if (mounted.value || !props.actor || !wide.value) return
    mounted.value = true
    await next_tick()
    try {
      const { mount } = await import('../../../terminal/src/terminal.js')
      if (left) return
      const user = current_user.value
      const { actor } = props
      terminal = await mount(pane.value, {
        actor,
        exec: 'brayness',
        wasm_url: new URL(wasm_url, location.href),
        focus: view.value === 'tui',
        open: size => open_terminal(user, actor, size)
      })
      if (left) terminal.close()
    } catch (thrown) {
      problem.value = `TUI: ${thrown.message}`
    }
  }

  /** The terminal sizes itself on window resize; tell it the pane moved. */
  const settle = () => window.dispatchEvent(new Event('resize'))

  watch(
    () => [shows.value.tui, props.actor],
    async ([open]) => {
      if (!open) return
      await mount_terminal()
      await next_tick()
      settle()
      if (view.value === 'tui') pane.value?.querySelector('canvas')?.focus()
    },
    { immediate: true }
  )

  on_before_unmount(() => {
    left = true
    terminal?.close()
  })
</script>

<template>
  <section
    id="tui-pane"
    aria-label="TUI"
    :data-open="shows.tui || undefined"
    :data-alone="view === 'tui' || undefined"
    :inert="!shows.tui || undefined"
    @transitionend.self="settle">
    <header>
      <slot />
    </header>
    <p v-if="problem" role="status">{{ problem }}</p>
    <section v-if="mounted" ref="pane" data-terminal>
      <canvas tabindex="0" />
      <output />
    </section>
  </section>
</template>

<style lang="stylus">
  section#tui-pane {
    // The chat column, as on /chat: page-width.
    chat-width = page-width
    position: fixed;
    inset-block: 0;
    inset-inline-start: chat-width;
    inset-inline-end: 0;
    z-index: 11;
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top, 0px);
    background: var(--surface);
    // Slides in from the right edge; hidden, but still laid out, once out,
    // so the terminal keeps its size.
    translate: 100% 0;
    visibility: hidden;
    transition-property: translate, visibility, inset-inline-start;
    transition-duration: var(--duration-subject, 0.3s);
    transition-timing-function: var(--ease-reveal, ease-out);
    &[data-open] {
      translate: 0 0;
      visibility: visible;
    }
    &[data-alone] {
      inset-inline-start: 0;
    }
    @media (prefers-reduced-motion: reduce) {
      transition-duration: 0.01ms;
    }
    & > header {
      padding: base-line;
    }
    & > p[role='status'] {
      margin: 0;
      padding: 0 base-line base-line;
    }
    & > section[data-terminal] {
      position: relative;
      flex: 1;
      min-block-size: 0;
      overflow: hidden;
      padding-inline: (base-line / 2);
      user-select: none;
      & > canvas {
        display: block;
        outline: none;
        cursor: text;
      }
      & > output {
        position: absolute;
        inset-block-end: 0;
        inset-inline-end: (base-line / 2);
        color: var(--muted-text);
        font-family: ui-monospace, Menlo, monospace;
        pointer-events: none;
      }
    }
  }
</style>
