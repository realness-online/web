<template lang="html">
  <fieldset id="range">
    <input type="range" list="steps" min="5" max="17567">
    <datalist id="steps">
      <option value="5">5k</option>
      <option value="8"></option>
      <option label="26k">13</option>
      <option value="21"></option>
      <option value="34"></option>
      <option value="55" label="136k">136k</option>
      <option value="89"></option>
      <option value="144"></option>
      <option value="233"></option>
      <option value="377"></option>
      <option value="610" label="1.5mb (1,589k)"></option>
      <option value="987"></option>
      <option value="1579"></option>
      <option value="2566" label="6.7mb (6,721k)"></option>
      <option value="4145"></option>
      <option value="6711"></option>
      <option value="10856" label="28.4mb (28,433k)"></option>
    </datalist>
  </fieldset>
</template>
<script>
  import fibonnacci from '@/modules/fibonacci'
  import sizer from '@/modules/sizer'
  export default {
  }
</script>
<style lang="stylus">
  fieldset#range
    width:100%
    margin: base-line
    padding: base-line
    input
      appearance: slider-horizontal
      width:100vw

</style>
