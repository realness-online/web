<script setup>
  import icon from '@/components/icon'
  import PreferencesMenu from '@/components/preferences-menu'
  import { ref } from 'vue'

  const settings = ref(null)

  const on_show_settings = () => {
    if (!settings.value) return

    if (settings.value.open) settings.value.close()
    else {
      settings.value.showModal()
      settings.value.focus()
    }
  }

  const on_click = event => {
    if (event.target === settings.value) settings.value.close()
  }

  defineExpose({ show: on_show_settings })
</script>

<template>
  <button aria-label="Settings" @click="on_show_settings">
    <icon name="gear" />
  </button>
  <dialog id="preferences" ref="settings" @click="on_click">
    <section>
      <header>
        <h1>Settings</h1>
      </header>
      <preferences-menu />
    </section>
  </dialog>
</template>

<style lang="stylus">
  button[aria-label='Settings'] {
    -webkit-tap-highlight-color: transparent;
    &:active,
    &:focus {
      outline: none;
      box-shadow: none;
    }
    focus-ring();
    svg.icon {
      width: base-line * 2;
      height: base-line * 2;
      fill: var(--graphite);
     stroke: var(--accent);
      stroke-width: 0.25px;
      &:active {
        outline: none;
      }
    }
  }

  dialog#preferences {
    margin: base-line base-line * 0.5;
    width: calc(100dvw - var(--base-line));
    min-width: calc(100dvw - var(--base-line));
    max-width: calc(100dvw - var(--base-line));
    max-height: calc(100dvh - var(--base-line) * 3);
    border-radius: base-line;
    box-sizing: border-box;
    overscroll-behavior-y: contain;

    &[open] {
      display: block;
      overflow-y: auto;
      padding: 0 base-line;
    }

    @media (min-width: pad-begins) {
      margin: auto;
      width: auto;
      min-width: page-width-large;
      max-width: 90vw;
      max-height: 85vh;
    }

    & > section menu.preferences-menu {
      margin: 0;
    }

    h1, svg.icon {
      color: var(--emphasis);
     fill: var(--emphasis);
    }
  }
</style>
