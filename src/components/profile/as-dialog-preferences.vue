<script setup>
  /** @typedef {import('@/types').Available_Command} Available_Command */
  import Icon from '@/components/icon'
  import Preference from '@/components/preference'
  import { ref, computed, inject } from 'vue'
  import { get_file_system } from '@/utils/file'
  import { get_command_description } from '@/utils/keymaps'

  const key_commands = inject('key-commands')
  const set_posters_folder = () => get_file_system()
  const settings = ref(null)

  const aspect_ratio_display = computed(() => 'auto')

  const show_settings = () => {
    if (!settings.value) return

    if (settings.value.open) settings.value.close()
    else {
      settings.value.showModal()
      settings.value.focus()
    }
  }

  const handle_click = event => {
    if (event.target === settings.value) settings.value.close()
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
        <preference name="animate" title="Animate posters" />
        <preference
          name="slice"
          title="Slice poster aspect ratio"
          subtitle="Use 'slice' instead of 'meet' to fill the container">
          <div class="aspect-ratio-info">
            <p>Current: {{ aspect_ratio_display }}</p>
            <p class="subtitle">Press 'r' to cycle, 'shift+r' to reverse</p>
          </div>
        </preference>
        <preference name="fill" title="Use a gradient to fill up your poster">
          <preference name="bold" />
          <preference name="medium" />
          <preference name="regular" />
          <preference name="light" />
          <preference name="background" />
        </preference>

        <preference
          name="stroke"
          title="Outline your graphic with a stroke in relevant color" />
        <preference name="cutout" title="Display cutouts of the poster">
          <preference name="boulder" />
          <preference name="rock" />
          <preference name="gravel" />
          <preference name="sand" />
          <preference name="sediment" />
        </preference>
        <preference name="drama" title="Dynamic lighting" />
        <preference
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

        <preference
          name="info"
          title="Show frames per second and other diagnostics" />
        <preference
          name="storytelling"
          title="Storytelling (side-scroll) view"
          subtitle="Show content in a horizontal, story-like format. Portraits animate up/down." />
        <preference
          name="show_menu"
          title="Show menu indicator"
          subtitle="Display '...' button on posters to access download options. Press 'm' to toggle." />
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
              standard-border: red
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
