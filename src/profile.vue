<template lang="html">
  <section id="profile">
    <header>
      <h1>Who are you?</h1>
    </header>
    <profile-as-figure></profile-as-figure>
    <form id="profile-form" action="index.html" method="post">
      <fieldset>
        <input type='text' id="name" itemprop="name" placeholder="Name">
      </fieldset>
      <fieldset id="profile-url">
        <label for="url">/</label>
        <input itemprop="url" id='url' type="url" value="" placeholder="profile-name">
      </fieldset>
      <fieldset id="profile-image" style="display:none">
        <label for="profile-image">Profile picture</label>
        <input type="file" id="profile-image" itemprop="profile-image">
        <figure>
          <img itemprop="image-url" src="" alt="">
          <figcaption>
            <a itemprop="url" href="url"> </a>
            <span itemprop=""></span>
          </figcaption>
        </figure>
      </fieldset>
    </form>
  </section>
</template>
<script>
  import profile_as_figure from '@/components/profile-as-figure'
  export default {
    components: {
      'profile-as-figure': profile_as_figure
    },
    data() {
      return {}
    }
  }
</script>
<style lang='stylus'>
  @require '/style/variables'
  section#profile
    padding: 0 base-line
  form#profile-form
    input
      color: red
      &:focus
        outline:0
        &::placeholder
          color:lighten(black, 40%)
      &::placeholder
        color: orange
    label[for=url]
      margin-right:-0.3em
    label[for=profile-image]
      color:orange
      cursor:pointer
    input[itemprop=profile-image]
      visibility: hidden
    & > fieldset
      padding: base-line
      border:0.37vmin solid black
      margin-bottom: base-line
      &:last-of-type
        margin-bottom:0
</style>
