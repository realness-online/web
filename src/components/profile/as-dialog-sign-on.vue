<script setup>
  import Icon from '@/components/icon'
  import AsSignOn from '@/components/profile/as-sign-on'
  import { ref } from 'vue'

  defineOptions({ name: 'AsDialogSignOn' })

  const emit = defineEmits(['signed_in'])
  const dialog = ref(null)
  const showing = ref(false)

  /* `show`, never `showModal`. A modal dialog lives in the browser's top
     layer, which paints above every normal-flow element no matter its
     z-index. Google appends the reCAPTCHA challenge to `document.body`, so a
     modal here buries the challenge and sign-on dead-ends. Non-modal costs us
     the UA backdrop, focus trap, and Esc — the scrim and the keydown below
     hand those back. */
  const open = () => {
    if (!dialog.value?.open) dialog.value?.show()
    showing.value = true
  }
  const close = () => {
    dialog.value?.close()
    showing.value = false
  }

  const on_signed_in = () => {
    close()
    emit('signed_in')
  }

  defineExpose({ open, close })
</script>

<template>
  <div v-if="showing" id="sign-on-scrim" />
  <dialog id="sign-on" ref="dialog" data-modal @keydown.esc.prevent="close">
    <article>
      <button type="button" aria-label="Close" @click="close">
        <icon name="remove" />
      </button>
      <as-sign-on @signed_in="on_signed_in" />
    </article>
  </dialog>
</template>

<style lang="stylus">
  /* Stands in for the ::backdrop a non-modal dialog does not get, and keeps
     the page behind from taking clicks the way an inert modal would. */
  div#sign-on-scrim {
    position: fixed;
    inset: 0;
    /* Over the app's fixed footer nav (z-index 9), which the top layer used
       to cover for free. */
    z-index: 10;
    frosted-glass();
  }

  dialog#sign-on {
    z-index: 11;
    padding: calc(var(--base-line) * 1.5);

    /* The flow swaps its fieldsets for a working indicator between steps. Hold
       the resting size so the dialog cannot collapse around it and shove the
       indicator up against the close button. Capped so a phone still fits. */
    /* unquote() because Stylus owns `min` as a function and would fold these
       down to a single argument. */
    min-width: unquote('min(calc(var(--base-line) * 22), calc(100vw - var(--base-line) * 3))');
    min-height: unquote('min(calc(var(--base-line) * 21), calc(100svh - var(--base-line) * 3))');

    /* Only when open — a bare `display: flex` would defeat the UA's
       `display: none` and show the dialog while it is closed. */
    &[open] {
      display: flex;
      flex-direction: column;
    }

    & > article {
      flex: 1;
      display: flex;
      flex-direction: column;

      & > button {
        align-self: flex-end;
        padding: 0;
        border: none;
        margin: 0;

        & > svg.icon {
          fill: var(--emphasis);
        }
      }

      /* Centre the flow in the held height rather than letting it ride up
         under the close button. */
      & > section#sign-on {
        margin-block: auto;
      }
    }

    /* Clay, matching the dialog's own border, instead of reading as a
       second control next to the close button. */
    svg[data-icon='working'] {
      fill: var(--emphasis);
      color: var(--emphasis);
    }

    /* A phone gets the whole viewport — a card floating in a scrim is the
       part of this flow that reads worst on a small screen. */
    @media (max-width: pad-begins) {
      inset: 0;
      transform: none;
      width: 100%;
      max-width: none;
      height: 100svh;
      max-height: none;
      border: none;
      border-radius: 0;
      padding: base-line;
    }
  }

  @media (max-width: pad-begins) {
    div#sign-on-scrim {
      display: none;
    }
  }
</style>
