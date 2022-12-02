<script setup>
  import LogoAsLink from '@/components/logo-as-link'
  import Icon from '@/components/icon'
</script>
<template>
  <section id="camera" class="page">
    <header>
      <nav>
        <a id="camera" @click="use_camera">
          <icon name="camera" />
        </a>
        <logo-as-link />   
      </nav>
    </header>
  </section>
</template>
<style lang="stylus">
  #camera > header > nav 
    display: flex
    
    & > a > svg.camera
      fill: red
    
</style>
