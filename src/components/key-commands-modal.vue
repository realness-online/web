<script setup>
  /** @typedef {import('@/types').Available_Command} Available_Command */
  import Icon from '@/components/icon'
  import { ref, computed, inject } from 'vue'
  import { get_command_description } from '@/utils/keymaps'

  const key_commands = inject('key-commands')
  const dialog = ref(null)

  const show_modal = () => {
    dialog.value.showModal()
  }

  const close_modal = () => {
    dialog.value.close()
  }

  const handle_click = event => {
    if (event.target === dialog.value) dialog.value.close()
  }

  const available_commands = computed(() => key_commands.get_available_commands.value)
  const stats = computed(() => key_commands.get_statistics())

  // Group commands by context
  const commands_by_context = computed(() => {
    const groups = {}
    available_commands.value.forEach(cmd => {
      const context = cmd.context || 'Global'
      if (!groups[context]) {
        groups[context] = []
      }
      groups[context].push({
        key: cmd.key,
        command: cmd.command,
        description: get_command_description(cmd.command),
        context: cmd.context
      })
    })
    return groups
  })

  // Expose show method for external use
  defineExpose({ show: show_modal })
</script>

<template>
  <dialog ref="dialog" class="key-commands" @click="handle_click">
    <article>
      <header>
        <h1>Keymap</h1>
      </header>
      <section v-for="(commands, context) in commands_by_context" :key="context">
        <h2>{{ context }}</h2>
        <ul>
          <li v-for="cmd in commands" :key="`${context}-${cmd.key}`">
            <kbd>{{ cmd.key }}</kbd>
            <span>{{ cmd.description }}</span>
          </li>
        </ul>
      </section>
    </article>
  </dialog>
</template>

<style lang="stylus">
  dialog.key-commands{
    & > article {
      max-width: var(--page-width);
      max-height: 80vh;
      overflow-y: auto;
      & > header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        h1 {
          color: var(--red);
        }
        & > a {
          cursor: pointer;
          & > svg.remove {
            fill: var(--white-text);
            width: base-line;
            height: base-line;
            &:hover {
              fill: var(--red);
            }
          }
        }
      }
      & > p {
        text-align: center;
        color: var(--blue);
        margin-bottom: base-line;
      }
      & > section {
        margin-bottom: base-line * 2;
        & > h2 {
          color: var(--red);
          margin-bottom: base-line;
          padding-bottom: round((base-line / 2), 2);
          border-bottom: 1px solid var(--red);
        }
        & > ul {
          list-style: none;

          & > li {
            display: flex;
            align-items: center;
            gap: base-line;
            margin-bottom: round((base-line / 2), 2);
            & > kbd {
              flex-shrink: 0;
              margin: 0;
              padding: round((base-line / 4), 2) round((base-line / 2), 2);
              font-size: 0.875rem;
              font-family: 'Monaco', 'Menlo', monospace;
            }
            & > span {
              color: var(--white-text);
              font-size: smaller;
            }
          }
        }
      }
    }
  }
</style>
