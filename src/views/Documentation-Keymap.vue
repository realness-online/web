<template>
  <article class="keymap-documentation">
    <header class="keymap-header">
      <h1>Realness Keymap Reference</h1>
      <div class="keymap-stats">
        <span>{{ stats.total_contexts }} contexts</span>
        <span>{{ stats.total_bindings }} bindings</span>
        <span>{{ stats.commands.length }} commands</span>
      </div>
    </header>

    <section class="keymap-contexts">
      <section
        v-for="context in available_contexts"
        :key="context"
        class="keymap-context">
        <h2>{{ context }}</h2>
        <table class="keymap-table">
          <thead>
            <tr>
              <th>Shortcut</th>
              <th>Command</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="binding in get_context_bindings(context)"
              :key="binding.key">
              <td>
                <code>{{ binding.key }}</code>
              </td>
              <td>
                <code>{{ binding.command }}</code>
              </td>
              <td>{{ binding.description }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </section>

    <section class="keymap-commands">
      <h2>All Commands</h2>
      <div class="commands-list">
        <div
          v-for="command in stats.commands"
          :key="command"
          class="command-item">
          <code>{{ command }}</code>
        </div>
      </div>
    </section>
  </article>
</template>

<script setup>
  import { computed, inject } from 'vue'
  import { get_command_description } from '@/utils/keymap-docs'

  const key_commands = inject('key-commands')

  const stats = computed(() => key_commands.get_statistics())
  const validation = computed(() => key_commands.validate_current_keymap())
  const available_contexts = computed(() => stats.value.contexts)

  const get_context_bindings = context_name => {
    const context_config = key_commands.keymap.value.find(
      config => (config.context || 'Global') === context_name
    )

    if (!context_config) return []

    return Object.entries(context_config.bindings || {}).map(
      ([key, command]) => ({
        key,
        command: typeof command === 'string' ? command : command[0],
        description: get_command_description(
          typeof command === 'string' ? command : command[0]
        )
      })
    )
  }
</script>

<style lang="stylus">
  article.keymap-documentation
    max-width: 1200px
    margin: 0 auto
    padding: base-line * 2

  header.keymap-header
    margin-bottom: base-line * 2
    padding-bottom: base-line
    border-bottom: 1px solid #333
    & > h1
      margin: 0 0 base-line 0
      color: #fff
    & > div.keymap-stats
      display: flex
      gap: base-line
      color: #888
      & > span
        background: #222
        padding: round((base-line / 4), 2) round((base-line / 2), 2)
        border-radius: 4px
        font-size: 0.875rem

  aside.keymap-warnings,
  aside.keymap-errors
    margin-bottom: base-line * 2
    padding: base-line
    border-radius: 8px
    & > h3
      margin: 0 0 round((base-line / 2), 2) 0
      color: #fff
    & > ul
      margin: 0
      padding-left: base-line * 1.5
      color: #ccc

  aside.keymap-warnings
    background: #2a2a00
    border: 1px solid #666600

  aside.keymap-errors
    background: #2a0000
    border: 1px solid #660000

  section.keymap-contexts
    margin-bottom: base-line * 3

  section.keymap-context
    margin-bottom: base-line * 2
    & > h2
      color: #fff
      margin-bottom: base-line
      padding-bottom: round((base-line / 2), 2)
      border-bottom: 1px solid #444

  table.keymap-table
    width: 100%
    border-collapse: collapse
    background: #1a1a1a
    border-radius: 8px
    overflow: hidden
    & > thead > tr > th,
    & > tbody > tr > td
      padding: round((base-line * 3 / 4), 2)
      text-align: left
      border-bottom: 1px solid #333
    & > thead > tr > th
      background: #222
      color: #fff
      font-weight: 600
    & > tbody > tr > td
      color: #ccc
      & > code
        background: #333
        padding: round((base-line / 4), 2) round((base-line / 2), 2)
        border-radius: 4px
        font-family: 'Monaco', 'Menlo', monospace
        font-size: 0.875rem

  section.keymap-commands
    & > h2
      color: #fff
      margin-bottom: base-line
    & > div.commands-list
      display: grid
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))
      gap: round((base-line / 2), 2)
      & > div.command-item
        background: #222
        padding: round((base-line / 2), 2)
        border-radius: 4px
        border: 1px solid #333
        & > code
          color: #4a9eff
          font-family: 'Monaco', 'Menlo', monospace
          font-size: 0.875rem
</style>
