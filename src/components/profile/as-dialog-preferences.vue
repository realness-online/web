<script setup>
  import Icon from '@/components/icon'
  import Preference from '@/components/preference'
  import { ref } from 'vue'
  import { get_file_system } from '@/utils/file'
  const set_posters_folder = () => get_file_system()
  const settings = ref(null)
  const show_settings = () => {
    settings.value.showModal()
  }
  const close_settings = () => {
    settings.value.close()
  }
  const handle_click = event => {
    if (event.target === settings.value) settings.value.close()
  }
</script>

<template>
  <a id="toggle-preferences" @click="show_settings">
    <icon name="gear" />
  </a>
  <dialog id="preferences" ref="settings" @click="handle_click">
    <header>
      <h1>Preferences</h1>
      <a id="close-settings" @click="close_settings">
        <icon name="finished" />
      </a>
    </header>
    <menu>
      <preference name="fill" title="Use a gradient to fill up your poster" />
      <preference
        name="stroke"
        title="Outline your graphic with a stroke in relevant color" />
      <preference
        name="emboss"
        title="Apply an emboss effect to each layer of a poster">
      </preference>
      <preference name="light" title="A subtle lightbar" />
      <preference
        name="adobe"
        hidden
        title="Posters download with HEX (#FFF000) values for color" />
      <preference
        hidden
        name="simple"
        title="Download posters with simple readable ids " />
      <preference
        hidden
        name="filesystem"
        title="Sync posters with a directory"
        subtitle="On an iphone this will save piture and exif info that you can sync on the a desktop machine"
        @on="set_posters_folder" />
      <preference name="animate" title="Animate posters" />
      <preference name="fps" title="show frames per second on the bottom right" />
    </menu>
  </dialog>
</template>

<style lang="stylus">
  a#toggle-preferences {
    position: fixed;
    bottom: base-line;
    left: base-line;
    z-index: 1000;
    svg.gear.icon {
      width: base-line * 0.95;
      height: base-line * 0.95;
      fill: black;
    }

  }
  dialog#preferences {
    padding-top: 0;
    margin-bottom: base-line * 2;
    & > header {
      > h1 {
        margin-top: base-line;
        text-align: center;
      }
      > a {
        position: absolute;
        top: base-line * .5;
        right: base-line * .5;
        svg.icon {
          fill: black;
          width: base-line ;
          height: base-line;
        }
      }
    }
    .download {
      display: inline-block;
      width: base-line * .75;
      height: base-line * .75;
    }
    a {
      color: green;
      border-color: green;
    }
    h1, svg.icon {
      color: red;
      fill: red;
    }
    & > article {
      padding: 0 base-line;
    }
    & > menu {
      margin: 0;
      padding: 0;
      & > *:not(:last-child) {
        height: 100%;
        list-style: none;
      }
      & > h4 {
        margin-top: base-line;
      }

    }
  }
</style>
