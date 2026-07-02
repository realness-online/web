<script setup>
  import { include_exif } from '@/utils/preference'

  defineOptions({ name: 'AsExif' })
</script>

<template>
  <section class="as-exif">
    <div>
      <h4>Include photo metadata</h4>
      <label class="switch">
        <input v-model="include_exif" type="checkbox" role="switch" switch />
        <span class="slider"></span>
      </label>
    </div>
    <small>
      Save camera, date, location, focus distance, compass bearing, and
      viewpoint metadata from the original photo in each poster index.
    </small>
  </section>
</template>

<style lang="stylus">
  section.as-exif
    padding: base-line 0
    & > div
      display: flex
      justify-content: space-between
      align-items: center
      gap: base-line * 0.5
      & > h4
        margin: 0
        font-size: normal
        font-weight: 300
    & > small
      display: block
      margin-top: base-line * 0.33
      opacity: 0.7
</style>
