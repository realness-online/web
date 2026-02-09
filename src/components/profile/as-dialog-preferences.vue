<script setup>
  /** @typedef {import('@/types').Available_Command} Available_Command */
  import Icon from '@/components/icon'
  import Preference from '@/components/preference'
  import { ref, computed, inject } from 'vue'
  import { get_command_description } from '@/utils/keymaps'
  import * as preferences from '@/utils/preference'

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
        <preference name="cutout" title="Display top layer of color cutouts" />
        <preference
          name="fill"
          title="Fill your shadow layer with gradients."
          subtitle="Shadows live behind the cutouts and tie the poster together; like the sun moving accross the sky" />
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
      </menu>
    </section>

    <section>
      <header>
        <h2>Keymap</h2>
      </header>
      <div
        v-for="(context_commands, context) in commands_by_context"
        :key="context"
        class="command-group">
        <h3>{{ context }}</h3>
        <div
          v-for="(commands, row) in context_commands"
          :key="`${context}-${row}`"
          class="row-group">
          <h4>{{ row }}</h4>
          <ul>
            <li v-for="cmd in commands" :key="`${context}-${row}-${cmd.key}`">
              <kbd v-bind="is_key_active(cmd) ? { 'data-active': '' } : {}">{{
                cmd.key
              }}</kbd>
              <span>{{ cmd.description }}</span>
            </li>
          </ul>
        </div>
      </div>
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

  dialog#preferences {
    padding-top: 0;
    margin-bottom: base-line * 2;
    max-width: 90vw;
    max-height: 90vh;
    &[open] {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: base-line * 2;

      overflow-y: auto;
      padding: 0 base-line;

      @media (max-width: pad-begins) {
        max-width: 100vw;
        width: 100vw;
        margin: 0;
        border-radius: 0;
        grid-template-columns: 1fr;
        gap: base-line;
        padding: 0 base-line;
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

    @media (max-width: pad-begins) {
      max-width: 100vw;
      width: 100vw;
      margin: 0;
      border-radius: 0;
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
      @media (max-width: pad-begins) {
        display: none;
      }

      & > div {
        h3 {
          color: var(--red);
          margin-top: base-line;
          margin-bottom: round((base-line / 2), 2);

        }
        ul {
          list-style: none;

          li {
            display: flex;
            align-items: center;
            gap: base-line;
            margin-bottom: round((base-line / 2), 2);

            kbd {
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

            span {
              color: var(--white-text);
              font-size: smaller;
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

  .aspect-ratio-info {
    margin-top: base-line * 0.5;
    p {
      margin: base-line * 0.25 0;
      font-size: smaller;
      &.subtitle {
        color: var(--white-text);
        opacity: 0.75;
      }
    }
  }
</style>
