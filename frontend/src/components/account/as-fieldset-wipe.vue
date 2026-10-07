<script setup>
  import { current_user } from '@/utils/serverless'
  import { keys, clear } from 'idb-keyval'
  import { ref, computed, watchEffect as watch_effect } from 'vue'

  defineOptions({ name: 'AsFieldsetWipe' })

  const index_db_keys = ref([])
  const confirm = ref(null)

  const cleanable = computed(() => {
    if (current_user.value) return false
    if (localStorage.me && localStorage.me.length > 2) return true
    if (localStorage.length > 2) return true
    if (index_db_keys.value.length > 1) return true
    return false
  })

  const on_ask_wipe = () => confirm.value?.showModal()
  const on_cancel_wipe = () => confirm.value?.close()

  const on_wipe = async () => {
    confirm.value?.close()
    const keys_to_remove = []
    for (const key in localStorage)
      if (Object.prototype.hasOwnProperty.call(localStorage, key))
        keys_to_remove.push(key)
    keys_to_remove.forEach(key => localStorage.removeItem(key))
    localStorage.me = '/+'
    await clear()
    window.location.href = '/'
  }

  watch_effect(async () => {
    index_db_keys.value = await keys()
  })
</script>

<template>
  <fieldset v-if="cleanable" data-preference>
    <div>
      <h4 data-labeled>Local data</h4>
      <button type="button" id="wipe" @click="on_ask_wipe">Wipe</button>
    </div>
  </fieldset>

  <dialog id="confirm-wipe" ref="confirm" data-modal>
    <p>Wipe everything stored in this browser?</p>
    <menu>
      <button type="button" @click="on_cancel_wipe">Cancel</button>
      <button type="button" id="confirm" @click="on_wipe">Wipe</button>
    </menu>
  </dialog>
</template>

<style>
  dialog#confirm-wipe {
    & > p {
      margin: 0;
    }

    & > menu {
      display: flex;
      justify-content: flex-end;
      gap: var(--base-line);
      margin-top: calc(var(--base-line) * 1.5);

      & > button {
        padding: var(--base-line);
        white-space: nowrap;
      }

      & > button#confirm {
        color: var(--emphasis);
      }
    }
  }
</style>
