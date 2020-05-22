<template lang="html">
  <figure>
    <icon name="background"/>
    <svg itemscope
         itemtype="/avatars"
         :itemid="avatar.id"
         :viewBox="avatar.viewbox"
         v-html="avatar.path"/>
  </figure>
</template>
<script>
  import icon from '@/components/icon'
  export default {
    components: {
      icon
    },
    props: {
      avatar: {
        type: Object,
        required: true
      }
    }
  }
</script>
