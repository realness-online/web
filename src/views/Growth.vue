<template lang="html">
  <section id="growth" class="page">
    <header>
      <div style="width:5px">
        <h2>5k</h2>
      </div>
      <div style="width:8px"> </div>
      <div style="width:13kpx">
        <h2>26k</h2>
      </div>
      <div style="width:21px"> </div>
      <div style="width:34px"> </div>
      <div style="width:55px">
        <h2>136k</h2>
      </div>
      <div style="width:89px"> </div>
      <div style="width:144px"> </div>
      <div style="width:233px"> </div>
      <div style="width:377px"> </div>
      <div style="width:610px">
        <h2> 1.5mb (1,589k)</h2>
      </div>
      <div style="width:987px"> </div>
      <div style="width:1579px"> </div>
      <div style="width:2566px">
        <h2>6.7mb (6,721k)</h2>
      </div>
      <div style="width:4145px"> </div>
      <div style="width:6711px"> </div>
      <div style="width:10856px">
        <h2>28.4mb (28,433k)</h2>
      </div>
    </header>
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
  </section>
  </template>
<script>
  import sizer from '@/modules/sizer'
  export default {
  }
</script>
<style lang="stylus">
  section#growth
    div
      height: base-line * 2
      h2
        display:none
        float:left;
      border: 1px solid red
      background-color: black
    fieldset#range
      width:100%
      margin: base-line
      padding: base-line
      input
        appearance: slider-horizontal
        width:100vw

</style>
