<script setup>
  import Icon from '@/components/icon'
  import AsSignOn from '@/components/profile/as-sign-on'
  import { ref } from 'vue'

  defineOptions({ name: 'AsDialogSignOn' })

  const emit = defineEmits(['signed_in'])
  const dialog = ref(null)

  const open = () => {
    if (!dialog.value?.open) dialog.value?.showModal()
  }
  const close = () => dialog.value?.close()

  const on_signed_in = () => {
    close()
    emit('signed_in')
  }

  defineExpose({ open, close })
</script>

<template>
  <dialog id="sign-on" ref="dialog" data-modal>
    <article>
      <button type="button" aria-label="Close" @click="close">
        <icon name="remove" />
      </button>
      <as-sign-on @signed_in="on_signed_in" />
    </article>
  </dialog>
</template>

<style>
  dialog#sign-on {
    padding: calc(var(--base-line) * 1.5);

    /* The flow swaps its fieldsets for a working indicator between steps. Hold
       the resting size so the dialog cannot collapse around it and shove the
       indicator up against the close button. Capped so a phone still fits. */
    min-width: min(
      calc(var(--base-line) * 22),
      calc(100vw - var(--base-line) * 3)
    );
    min-height: min(
      calc(var(--base-line) * 21),
      calc(100svh - var(--base-line) * 3)
    );

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
  }
</style>
