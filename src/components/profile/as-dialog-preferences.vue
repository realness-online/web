<script setup>
  /** @typedef {import('@/types').Available_Command} Available_Command */
  import Icon from '@/components/icon'
  import Preference from '@/components/preference'
  import { ref, computed, inject } from 'vue'
  import { get_command_description } from '@/utils/keymaps'
  import * as preferences from '@/utils/preference'
  import {
    sync_folder_supported,
    use as use_sync_folder
  } from '@/use/sync-folder'

  const sync_folder_supported_value = sync_folder_supported()
  const { sync_folder, sync_folder_name } = use_sync_folder()

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

    // Get the keymap directly to preserve order
    const keymap = key_commands.keymap.value
    const active_contexts = key_commands.active_contexts.value

    keymap.forEach(context_config => {
      const context = context_config.context || 'Global'

      if (context === 'Global' || active_contexts.includes(context)) {
        if (!groups[context]) groups[context] = {}

        const keys = Object.getOwnPropertyNames(context_config.bindings || {})
        let current_row = 'Number Row' // Default to Number Row

        keys.forEach(key => {
          const command = context_config.bindings[key]

          // Check if this is a row label
          if (typeof command === 'string' && command === '') {
            current_row = key
            if (!groups[context][current_row]) groups[context][current_row] = []
            return
          }

          // Add command to current row
          if (typeof command === 'string' && command) {
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
      }
    })

    return groups
  })

  defineExpose({ show: show_settings })
</script>

<template>
  <a id="toggle-preferences" @click="show_settings">
    <icon name="corner" />
  </a>
  <dialog
    id="preferences"
    ref="settings"
    @click="handle_click"
    @close="dialog_open = false">
    <header>
      <h1>Preferences</h1>
    </header>

    <section>
      <header>
        <h2>Settings</h2>
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
      </menu>
    </section>

    <section>
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
  a#toggle-preferences {
    position: fixed;
    bottom: base-line;
    left: base-line;
    z-index: 9;
    svg.gear.icon {
      width: base-line;
      height: base-line;
      fill: black;
      stroke: blue;
      stroke-width: 0.25px;
    }
  }

  :fullscreen a#toggle-preferences {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  main#realness:has(article.thought:focus-within) > a#toggle-preferences {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  dialog#preferences {
    margin: base-line;
    max-width: 90vw;
    border-radius: base-line;

    &[open] {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: base-line * 2;
      overflow-y: auto;
      padding: 0 base-line;
    }

    @media (max-width: pad-begins) {
      position: fixed;
      top: inset(top, base-line * 3);
      bottom: 0;
      left: 0;
      right: 0;
      margin: 0;
      max-width: 100%;
      width: 100%;
      border-radius: base-line base-line 0 0;
      overscroll-behavior-y: contain;
      &[open] {
        grid-template-columns: 1fr;
        gap: base-line;
        padding: 0 base-line inset(bottom) base-line;
      }
      & > section:last-child {
        display: none;
      }
    }

    & > header {
      grid-column: 1 / -1;
      & > h1 {
        margin-top: base-line;
        text-align: center;
      }
      & > a {
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

    & > section {
      & > header > h2 {
        color: var(--red);
        margin-bottom: base-line;
        padding-bottom: round((base-line / 2), 2);
        border-bottom: 1px solid var(--red);
      }
    }

    & > section:first-child {
      menu {
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

    & > section:last-child {
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
                border-color: green;
                box-shadow: 0 0 round((base-line / 2), 2) green;
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

    a {
      color: green;
      border-color: green;
    }
    h1, svg.icon {
      color: red;
      fill: red;
    }
  }
</style>
