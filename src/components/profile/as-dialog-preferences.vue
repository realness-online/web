<script setup>
  /** @typedef {import('@/types').Available_Command} Available_Command */
  import Icon from '@/components/icon'
  import Preference from '@/components/preference'
  import { ref, computed, inject, onMounted as mounted } from 'vue'
  import { get_file_system } from '@/utils/file'
  import { get_command_description } from '@/utils/keymaps'

  const key_commands = inject('key-commands')
  const set_posters_folder = () => get_file_system()
  const settings = ref(null)

  const show_settings = () => {
    settings.value.showModal()
  }

  const handle_click = event => {
    if (event.target === settings.value) settings.value.close()
  }

  const available_commands = computed(
    () => key_commands.get_available_commands.value
  )

  // Group commands by keyboard rows
  const commands_by_context = computed(() => {
    const groups = {}

    // Get the keymap directly to preserve order
    const keymap = key_commands.keymap.value

    keymap.forEach(context_config => {
      const context = context_config.context || 'Global'
      if (!groups[context]) groups[context] = {}

      // Use getOwnPropertyNames to preserve the order properties were defined
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
            key: key,
            command: command,
            description: get_command_description(command),
            context: context
          }
          groups[context][current_row].push(cmd_obj)
        }
      })
    })

    return groups
  })

  // Expose show method for external use
  defineExpose({ show: show_settings })
</script>

<template>
  <a id="toggle-preferences" @click="show_settings">
    <icon name="gear" />
  </a>
  <dialog id="preferences" ref="settings" @click="handle_click">
    <header>
      <h1>Preferences</h1>
    </header>

    <section>
      <header>
        <h2>Settings</h2>
      </header>
      <menu>
        <preference name="fill" title="Use a gradient to fill up your poster" >
          <preference name="bold" />
          <preference name="medium" />
          <preference name="regular" />
          <preference name="light" />
        </preference>
        <preference
          name="stroke"
          title="Outline your graphic with a stroke in relevant color" />
        <preference name="cutout" title="Display coutouts of the poster">
        </preference>
        <preference name="background" title="Display a background fill">
        </preference>
        <preference name="drama" title="Dynamic lighting" />
        <preferencez
          name="adobe"
          hidden
          title="Posters download with HEX (#FFF000) values for color" />
        <preference
          hidden
          name="simple"
          title="Download posters with simple readable ids" />
        <preference
          hidden
          name="filesystem"
          title="Sync posters with a directory"
          subtitle="On an iphone this will save piture and exif info that you can sync on the a desktop machine"
          @on="set_posters_folder" />
        <preference name="animate" title="Animate posters" />
        <preference
          name="fps"
          title="Show frames per second and other diagnostics" />
        <preference
          name="storytelling"
          title="Storytelling (side-scroll) view"
          subtitle="Show content in a horizontal, story-like format. Portraits animate up/down." />
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
              <kbd>{{ cmd.key }}</kbd>
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
    max-width: 90vw;
    max-height: 90vh;
    &[open] {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: base-line * 2;
      max-height: 70vh;
      overflow-y: auto;
      padding: 0 base-line;
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
      grid-template-columns: 1fr;
      gap: base-line;
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
      h2 {
        color: var(--red);
        margin-bottom: base-line;
        padding-bottom: round((base-line / 2), 2);
        border-bottom: 1px solid var(--red);
      }

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
              flex-shrink: 0;
              margin: 0;
              padding: round((base-line / 4), 2) round((base-line / 2), 2);
              font-family: 'Monaco', 'Menlo', monospace;
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

</style>
