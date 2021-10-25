<template lang="html">
  <event-as-fieldset v-if="poster.picker" :itemid="poster.id" @picker="picker(poster.id)" />
  <menu v-else>
    <event-as-button :itemid="poster.id" @picker="picker(poster.id)" />
    <router-link class="gear" :to="edit_poster(poster.id)">
      <icon name="gear" />
    </router-link>
    <a class="remove" @click="remove_poster(poster.id)">
      <icon name="remove" />
    </a>
    <as-download :itemid="poster.id" />
  </menu>
</template>

<script>
  import { ref } from 'vue'
  import { useKeypress as use_keypress } from 'vue3-keypress'
  import { useRouter as use_router } from 'vue-router'

  import icon from '@/components/icon'
  import event_as_fieldset from '@/components/events/as-fieldset'
  import event_as_button from '@/components/events/as-button'
  import as_download from '@/components/download-vector'
  import { as_created_at } from '@/helpers/itemid'

  export default {
    components: {
      icon,
      'event-as-fieldset': event_as_fieldset,
      'event-as-button': event_as_button,
      'as-download': as_download
    },
    props: {
      poster: {
        type: Object,
        required: true
      }
    },
    setup (props) {
      const router = use_router()
      const edit_poster = (itemid) => `/posters/${as_created_at(itemid)}/editor`
      const open_editor = () => router.replace({ path: edit_poster(props.poster.id) })

      use_keypress({
        keyEvent: 'keydown',
        isActive: ref(true),
        keyBinds: [{ keyCode: 'enter', success: open_editor }]
      })

      return {
        edit_poster
      }
    }
  }
</script>

<style lang="stylus">
</style>
