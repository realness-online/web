<script setup>
  /** @typedef {import('@/types').Available_Command} Available_Command */
  import Icon from '@/components/icon'
  import Preference from '@/components/preference'
  import { ref, computed, inject, watch, onBeforeUnmount, nextTick } from 'vue'
  import { Pane } from 'tweakpane'
  import { get_command_description } from '@/utils/keymaps'
  import * as preferences from '@/utils/preference'
  import {
    sync_folder_supported,
    use as use_sync_folder
  } from '@/use/sync-folder'

  const sync_folder_supported_value = sync_folder_supported()
  const { sync_folder, sync_folder_name } = use_sync_folder()

  const tweakpane_ref = ref(null)
  let pane = null

  const dispose_pane = () => {
    if (!pane) return
    pane.dispose()
    pane = null
  }

  const mount_pane = () => {
    if (!tweakpane_ref.value || pane) return
    const p = preferences
    const settings = {
      mosaic_spread: p.mosaic_spread.value,
      mosaic_opacity: p.mosaic_opacity.value,
      shadow_spread: p.shadow_spread.value,
      shadow_opacity: p.shadow_opacity.value,
      group_gap: p.group_gap.value,
      tilt_amount: p.tilt_amount.value,
      gyro_amount: p.gyro_amount.value,
      haze_enabled: p.haze_enabled.value,
      haze_color: p.haze_color.value,
      haze_density: p.haze_density.value,
      drift_amount: p.drift_amount.value,
      drift_speed: p.drift_speed.value,
      breathing_amount: p.breathing_amount.value,
      breathing_speed: p.breathing_speed.value
    }

    pane = new Pane({ container: tweakpane_ref.value })

    const sync = () => {
      p.mosaic_spread.value = settings.mosaic_spread
      p.mosaic_opacity.value = settings.mosaic_opacity
      p.shadow_spread.value = settings.shadow_spread
      p.shadow_opacity.value = settings.shadow_opacity
      p.group_gap.value = settings.group_gap
      p.tilt_amount.value = settings.tilt_amount
      p.gyro_amount.value = settings.gyro_amount
      p.haze_enabled.value = settings.haze_enabled
      p.haze_color.value = settings.haze_color
      p.haze_density.value = settings.haze_density
      p.drift_amount.value = settings.drift_amount
      p.drift_speed.value = settings.drift_speed
      p.breathing_amount.value = settings.breathing_amount
      p.breathing_speed.value = settings.breathing_speed
    }

    const mosaic_folder = pane.addFolder({ title: 'mosaic' })
    mosaic_folder
      .addBinding(settings, 'mosaic_spread', {
        label: 'spread',
        min: 0,
        max: 0.01,
        step: 0.0001
      })
      .on('change', sync)
    mosaic_folder
      .addBinding(settings, 'mosaic_opacity', {
        label: 'opacity',
        min: 0,
        max: 1,
        step: 0.01
      })
      .on('change', sync)

    const shadow_folder = pane.addFolder({ title: 'shadows' })
    shadow_folder
      .addBinding(settings, 'shadow_spread', {
        label: 'spread',
        min: 0,
        max: 0.03,
        step: 0.0001
      })
      .on('change', sync)
    shadow_folder
      .addBinding(settings, 'shadow_opacity', {
        label: 'opacity',
        min: 0,
        max: 1,
        step: 0.01
      })
      .on('change', sync)
    shadow_folder
      .addBinding(settings, 'group_gap', {
        label: 'group gap',
        min: -0.5,
        max: 1.5,
        step: 0.01
      })
      .on('change', sync)

    const camera_folder = pane.addFolder({ title: 'camera' })
    camera_folder
      .addBinding(settings, 'tilt_amount', {
        label: 'arrow tilt',
        min: 0,
        max: 2.0,
        step: 0.01
      })
      .on('change', sync)
    camera_folder
      .addBinding(settings, 'gyro_amount', {
        label: 'gyro tilt',
        min: 0,
        max: 3.0,
        step: 0.01
      })
      .on('change', sync)

    const haze_folder = pane.addFolder({ title: 'haze' })
    haze_folder
      .addBinding(settings, 'haze_enabled', { label: 'enabled' })
      .on('change', sync)
    haze_folder
      .addBinding(settings, 'haze_color', { label: 'color' })
      .on('change', sync)
    haze_folder
      .addBinding(settings, 'haze_density', {
        label: 'max',
        min: 0,
        max: 0.5,
        step: 0.005
      })
      .on('change', sync)

    const motion_folder = pane.addFolder({ title: 'motion' })
    motion_folder
      .addBinding(settings, 'drift_amount', {
        label: 'drift amount',
        min: 0,
        max: 0.005,
        step: 0.0001
      })
      .on('change', sync)
    motion_folder
      .addBinding(settings, 'drift_speed', {
        label: 'drift speed',
        min: 0,
        max: 0.5,
        step: 0.01
      })
      .on('change', sync)
    motion_folder
      .addBinding(settings, 'breathing_amount', {
        label: 'breath amount',
        min: 0,
        max: 0.05,
        step: 0.001
      })
      .on('change', sync)
    motion_folder
      .addBinding(settings, 'breathing_speed', {
        label: 'breath speed',
        min: 0,
        max: 3,
        step: 0.05
      })
      .on('change', sync)
  }

  watch(
    () => preferences.view_3d.value,
    async val => {
      if (val) {
        await nextTick()
        mount_pane()
      } else dispose_pane()
    },
    { immediate: true }
  )

  onBeforeUnmount(dispose_pane)

  const key_commands = inject('key-commands')
  const settings = ref(null)
  const dialog_open = ref(false)

  const command_to_preference_name = command => {
    if (!command.startsWith('pref::Toggle_')) return null
    const name = command.replace('pref::Toggle_', '')
    return name.charAt(0).toLowerCase() + name.slice(1)
  }

  const is_preference_active = command => {
    const pref_name = command_to_preference_name(command)
    if (!pref_name) return false
    const pref = preferences[pref_name]
    if (!pref) return false
    return pref.value
  }

  const is_dialog_open = computed(() => dialog_open.value)

  const is_key_active = cmd => {
    if (cmd.command === 'ui::Open_Settings') return is_dialog_open.value
    return is_preference_active(cmd.command)
  }

  const show_settings = () => {
    if (!settings.value) return

    if (settings.value.open) {
      settings.value.close()
      dialog_open.value = false
    } else {
      settings.value.showModal()
      settings.value.focus()
      dialog_open.value = true
    }
  }

  const handle_click = event => {
    if (event.target === settings.value) {
      settings.value.close()
      dialog_open.value = false
    }
  }

  // Group commands by keyboard rows
  const commands_by_context = computed(() => {
    const groups = {}

    const keymap = key_commands.keymap.value

    keymap.forEach(context_config => {
      const context = context_config.context || 'Global'
      if (!groups[context]) groups[context] = {}

      const keys = Object.getOwnPropertyNames(context_config.bindings || {})
      let current_row = null

      keys.forEach(key => {
        const command = context_config.bindings[key]

        if (typeof command === 'string' && command === '') {
          current_row = key
          if (!groups[context][current_row]) groups[context][current_row] = []
          return
        }

        if (typeof command === 'string' && command) {
          if (!current_row) current_row = 'Shortcuts'
          if (!groups[context][current_row]) groups[context][current_row] = []

          const cmd_obj = {
            key,
            command,
            description: get_command_description(command),
            context
          }
          groups[context][current_row].push(cmd_obj)
        }
      })
    })

    return groups
  })

  defineExpose({ show: show_settings })
</script>

<template>
  <a aria-label="Settings" @click="show_settings">
    <icon name="gear" />
  </a>
  <dialog
    id="preferences"
    ref="settings"
    @click="handle_click"
    @close="dialog_open = false">
    <section>
      <header>
        <h1>Settings</h1>
      </header>
      <menu>
        <preference name="mosaic" title="Display top layer of color mosaic" />
        <preference
          name="shadow"
          title="Shadow layer with gradients."
          subtitle="Shadows live behind the mosaic and tie the poster together; like the sun moving accross the sky" />
        <preference
          name="stroke"
          title="Outline your shadow layer with a stroke" />

        <preference name="drama" title="Dynamic lighting" />
        <preference
          name="adobe"
          hidden
          title="Posters download with HEX (#FFF000) values for color" />
        <div
          v-if="preferences.view_3d.value"
          ref="tweakpane_ref"
          class="tweakpane-3d" />

        <preference
          v-if="sync_folder_supported_value"
          name="sync_folder"
          :title="
            sync_folder_name
              ? null
              : 'Export full output (PSD, movie, SVG, PNG, layered PNG) to a folder'
          ">
          <p v-if="sync_folder_name">
            Export full output (PSD, movie, SVG, PNG, layered PNG) to
            <span class="location">{{ sync_folder_name }}</span>
          </p>
          <button type="button" @click="sync_folder">Choose folder</button>
        </preference>
      </menu>
    </section>

    <section class="keymap-panel">
      <header>
        <h2>Keymap</h2>
      </header>
      <article
        v-for="(context_commands, context) in commands_by_context"
        :key="context">
        <header>
          <h3>{{ context }}</h3>
        </header>
        <div
          v-for="(commands, row) in context_commands"
          :key="`${context}-${row}`">
          <h4>{{ row }}</h4>
          <ul>
            <li v-for="cmd in commands" :key="`${context}-${row}-${cmd.key}`">
              <kbd v-bind="is_key_active(cmd) ? { 'data-active': '' } : {}">{{
                cmd.key
              }}</kbd>
              <b>{{ cmd.description }}</b>
            </li>
          </ul>
        </div>
      </article>
    </section>
  </dialog>
</template>

<style lang="stylus">
  a[aria-label='Settings'] {
    svg.icon {
      width: base-line * 2;
      height: base-line * 2;
      fill: black;
      stroke: blue;
      stroke-width: 0.25px;
    }
  }

  dialog#preferences {
    margin: (base-line * 2);
    max-width: 100%;
    max-height: calc(100dvh - var(--base-line) * 5);
    border-radius: base-line;
    overscroll-behavior-y: contain;

    &[open] {
      display: grid;
      grid-template-columns: 1fr;
      gap: base-line;
      overflow-y: auto;
    }

    @media (min-width: pad-begins) {
      margin:  auto;
      max-width: 90vw;
      max-height: 85vh;
      &[open] {
        grid-template-columns: 1fr 1fr;
        gap: base-line * 2;
        padding: 0 base-line;
      }
    }

    & > section:first-child menu {
      margin: 0;
      padding: 0;
    }

    & > section.keymap-panel {
      display: none;
      @media (min-width: pad-begins) {
        display: block;
      }
    }

    & > section:last-child {
      & > header h2 {
        color: var(--red);
        margin-bottom: round((base-line / 2), 2);
        padding-bottom: round((base-line / 2), 2);
        border-bottom: 1px solid var(--red);
      }

      & > article {
        & > header h3 {
          color: var(--red);
          margin-top: base-line;
          margin-bottom: round((base-line / 2), 2);
        }

        & > div ul {
          list-style: none;

          & > li {
            display: flex;
            align-items: center;
            gap: base-line;
            margin-bottom: round((base-line / 2), 2);

            & > kbd {
              standard-border: red
              flex-shrink: 0;
              margin: 0;
              padding: round((base-line / 4), 2) round((base-line / 2), 2);
              font-family: 'Monaco', 'Menlo', monospace;
              transition: box-shadow 0.3s ease, border-color 0.3s ease;
              &[data-active] {
                border-color: blue;
                box-shadow: 0 0 round((base-line / 2), 2) blue;
              }
            }

            & > span {
              color: var(--white-text);
              font-size: smaller;
              @media (prefers-color-scheme: light) {
                color: black;
              }
            }
          }
        }
      }
    }

    h1, svg.icon {
      color: red;
      fill: red;
    }
  }

  .tweakpane-3d {
    padding: round((base-line / 2), 2);
    standard-border: black;

    .tp-dfwv {
      width: 100%;
      position: static;

      --tp-base-background-color: black-background;
      --tp-base-shadow-color: transparent;
      --tp-base-border-radius: round((base-line / 3), 2);
      --tp-base-font-family: inherit;

      --tp-container-background-color: rgba(255, 255, 255, 0.04);
      --tp-container-background-color-hover: rgba(255, 255, 255, 0.07);
      --tp-container-background-color-focus: rgba(255, 255, 255, 0.07);
      --tp-container-background-color-active: rgba(255, 255, 255, 0.10);
      --tp-container-foreground-color: white-text;

      --tp-input-background-color: rgba(255, 255, 255, 0.06);
      --tp-input-background-color-hover: blue;
      --tp-input-background-color-focus: blue;
      --tp-input-background-color-active: blue;
      --tp-input-foreground-color: white-text;

      --tp-label-foreground-color: white-text;
      --tp-groove-foreground-color: rgba(255, 255, 255, 0.08);

      --tp-button-background-color: rgba(255, 255, 255, 0.06);
      --tp-button-background-color-hover: blue;
      --tp-button-background-color-focus: blue;
      --tp-button-background-color-active: blue;
      --tp-button-foreground-color: white-text;

      --tp-monitor-background-color: rgba(255, 255, 255, 0.04);
      --tp-monitor-foreground-color: white-text;
    }
  }
</style>
