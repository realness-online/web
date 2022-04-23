<script setup>
  import { ref } from 'vue'
  const samples = ref([])
</script>
<template>
  <section id="about" class="page">
    <header>
      <nav>
        <icon name="nothing" />
        <logo-as-link />
      </nav>
      <h1>Realness</h1>
      <p>A low-fi vector graphics network</p>
      <figure>
        <icon name="hero" />
      </figure>
    </header>
    <details>
      <summary>For Designers</summary>
      <h3>Turn your photos into design material</h3>
      <p>
        Realness makes it Posters from photos — by turning photos into vector
        graphics. Posters are then stored on device for you to download and us.
      </p>
      <p>
        Realness creates a 4 layer svg from any image. It pulls out prediminate
        colors and optimized the vector to the smallest possible size.
      </p>
      <h4>With realness</h4>
      <ol>
        <li>Conversion and storage is done on device</li>
        <li>Edit the color, gradient and opacity of each layer</li>
        <li>A timeline view that includes your comments about each Poster</li>
        <li>Vectors are configured to be infinitly animatable</li>
        <li>Background, light, regular, and bold can be animated seperatly</li>
        <li>Supports accessing posters from your filesystem</li>
        <li>Sign up if you want to sync accross devices, or share</li>
      </ol>
    </details>
    <details>
      <summary>For Churches, Punks, Veterans</summary>
    </details>
    <details>
      <summary>For Developers</summary>
      <a href="https://github.com/realness-online/web" rel="external">
        Open Source
      </a>
    </details>
    <footer class="call to action"></footer>
  </section>
  <figure>
    <figcaption>Realness in action</figcaption>
  </figure>
</template>
<style lang="stylus"></style>
