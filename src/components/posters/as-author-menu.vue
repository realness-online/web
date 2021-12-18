<template>
  <event-as-fieldset
    v-if="poster.picker"
    :itemid="poster.id"
    @picker="picker(poster.id)" />
  <menu v-else>
    <event-as-button :itemid="poster.id" @picker="picker(poster.id)" />
    <router-link class="gear" :to="edit_poster(poster.id)">
      <icon name="gear" />
    </router-link>
    <a class="remove" @click="emit('remove', poster.id)">
      <icon name="remove" />
    </a>
    <as-download :itemid="poster.id" />
  </menu>
</template>

<script setup>
  import icon from '@/components/icon'
  import eventAsFieldset from '@/components/events/as-fieldset'
  import eventAsButton from '@/components/events/as-button'
  import asDownload from '@/components/download-vector'

  import { useRouter as use_router } from 'vue-router'
  import { watch } from 'vue'
  import { useMagicKeys as use_magic_keys } from '@vueuse/core'
  import { as_created_at, as_type } from '@/use/itemid'
  import { is_vector_id } from '@/use/vector'
  const props = defineProps({
    poster: {
      type: Object,
      required: true
    }
  })
  const emit = defineEmits({ remove: is_vector_id })
  const router = use_router()
  const edit_poster = itemid =>
    `/${as_type(itemid)}/${as_created_at(itemid)}/editor`
  const open_editor = () =>
    router.replace({ path: edit_poster(props.poster.id) })

  const { enter } = use_magic_keys()
  watch(enter, v => {
    if (v) open_editor()
  })
</script>
