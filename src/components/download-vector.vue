<template lang="html">
  <a id="download-avatar" :href="downloadable" download='vector.svg'>
    <icon name="download"></icon>
  </a>
</template>
<script>
  export default {
    computed: {
      downloadable() {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
          ${this.person.avatar}
          <use href="${profile_id.as_avatar_fragment(this.person.id)}"/>
        </svg>`
        return `data:application/octet-stream,${encodeURIComponent(svg)}`
      }
    }
  }
</script>
<style lang="stylus" >
</style>
