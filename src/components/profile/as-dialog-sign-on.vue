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

    & > article {
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
    }
  }
</style>
