<script setup>
  /** @typedef {import('@/types').Available_Command} Available_Command */
  import Icon from '@/components/icon'
  import Preference from '@/components/preference'
  import { ref, computed, inject, watch } from 'vue'
  import { get } from 'idb-keyval'
  import { get_command_description } from '@/utils/keymaps'
  import * as preferences from '@/utils/preference'

  const { homescreen_icon } = preferences
  import {
    homescreen_poster_icon_idb_key,
    clear_saved_poster_homescreen_icon
  } from '@/utils/homescreen-icon'
  import {
    sync_folder_supported,
    use as use_sync_folder
  } from '@/use/sync-folder'

  const sync_folder_supported_value = sync_folder_supported()
  const { sync_folder, sync_folder_name } = use_sync_folder()

  const key_commands = inject('key-commands')
  const settings = ref(null)
  const dialog_open = ref(false)
  const poster_homescreen_saved = ref(false)

  const refresh_poster_homescreen_state = async () => {
    const blob = await get(homescreen_poster_icon_idb_key)
    poster_homescreen_saved.value = !!blob
  }

  watch(dialog_open, open => {
    if (open) void refresh_poster_homescreen_state()
  })

  const remove_poster_homescreen_icon = async () => {
    await clear_saved_poster_homescreen_icon()
    homescreen_icon.value = 'brand'
    await refresh_poster_homescreen_state()
  }

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
        <preference
          name="animate"
          title="Animate posters"
          subtitle="This one loves a big strong GPU" />

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

        <fieldset class="homescreen-icon-fieldset">
          <legend>Homescreen icon</legend>
          <label class="homescreen-icon-option">
            <input v-model="homescreen_icon" type="radio" value="brand" />
            Realness logo
          </label>
          <label class="homescreen-icon-option">
            <input
              v-model="homescreen_icon"
              type="radio"
              value="poster"
              :disabled="!poster_homescreen_saved" />
            Poster snapshot
          </label>
          <p v-if="!poster_homescreen_saved" class="homescreen-icon-hint">
            Open any poster, use Download, then Homescreen to save a square
            snapshot. Re-add to the home screen if the icon does not update.
          </p>
          <button
            v-if="poster_homescreen_saved"
            type="button"
            class="homescreen-icon-clear"
            @click="remove_poster_homescreen_icon">
            Remove poster snapshot
          </button>
        </fieldset>
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

    fieldset.homescreen-icon-fieldset {
      margin: base-line 0 0;
      padding: base-line;
      border-radius: base-line * 0.25;
      border: 1px solid rgba(255, 255, 255, 0.15);

      @media (prefers-color-scheme: light) {
        border-color: rgba(0, 0, 0, 0.15);
      }

      legend {
        padding: 0 round((base-line / 4), 2);
        font-weight: bold;
      }

      label.homescreen-icon-option {
        display: flex;
        align-items: center;
        gap: round((base-line / 2), 2);
        margin-bottom: round((base-line / 2), 2);
        cursor: pointer;
      }

      p.homescreen-icon-hint {
        margin: 0 0 round((base-line / 2), 2);
        font-size: smaller;
        opacity: 0.85;
      }

      button.homescreen-icon-clear {
        margin-top: round((base-line / 4), 2);
      }
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
</style>
