<script setup>
  import { key_overview, key_overview_totals } from '@/utils/keys-overview'
  import { computed } from 'vue'
  import KeysKeyboard from '@/components/keys-keyboard.vue'

  const groups = key_overview()
  const totals = computed(() => key_overview_totals(groups))

  /** `ctrl-s` reads as `Ctrl+S`; a bare letter is left alone. */
  const readable_key = key => {
    if (!key) return ''
    if (key.startsWith('Option+')) return key
    return key
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('+')
  }
</script>

<template>
  <section
    data-page
    itemscope
    itemtype="https://realness.online/keys"
    lang="en">
    <header>
      <h1>Keys</h1>
    </header>
    <article>
      <header>
        <p>
          Every key command the app supports, grouped by where it applies.
          {{ totals.keys }} keys across {{ totals.commands }} commands.
        </p>
      </header>

      <keys-keyboard :groups="groups" />

      <section
        v-for="group in groups"
        :key="group.id"
        itemprop="hasPart"
        :data-group="group.id">
        <header>
          <h2>{{ group.title }}</h2>
          <p>{{ group.summary }}</p>
          <p data-scope>{{ group.scope }}</p>
        </header>

        <ul data-constraints>
          <li v-for="note in group.constraints" :key="note">{{ note }}</li>
        </ul>

        <table>
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">Does</th>
              <th scope="col">Fires</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(entry, index) in group.entries"
              :key="`${entry.command}-${entry.key}-${index}`"
              :data-unbound="!entry.key || undefined"
              :data-shadowed="(entry.key && !entry.reachable) || undefined">
              <td>
                <kbd v-if="entry.key">{{ readable_key(entry.key) }}</kbd>
                <span v-else data-none>unbound</span>
              </td>
              <td>
                {{ entry.description }}
                <small v-if="entry.command">{{ entry.command }}</small>
              </td>
              <td>
                <span v-if="!entry.key" data-none>no key</span>
                <span v-else-if="entry.reachable" data-ok>yes</span>
                <span v-else data-none>no</span>
                <small v-if="entry.note">{{ entry.note }}</small>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </article>
  </section>
</template>

<style lang="stylus">
  section[itemtype$='/keys'] {
    margin: 0 auto;
    padding: 0 base-line;
    padding-bottom: base-line * 4;
    max-width: support-page-width;

    & > header {
      display: block;
      padding: 0;
      margin-bottom: base-line * 2;

      h1 {
        margin-top: base-line;
        text-align: center;
        color: var(--emphasis);
      }
    }

    article {
      display: block;

      & > header p {
        text-align: center;
        margin-bottom: base-line * 2;
      }

      & > section {
        margin-bottom: base-line * 3;

        & > header {
          display: block;
          padding: 0;

          h2 {
            margin-bottom: base-line * 0.25;
          }

          p {
            margin: 0;
          }

          p[data-scope] {
            font-size: smaller;
            color: var(--accent);
          }
        }

        ul[data-constraints] {
          list-style: none;
          padding: 0;
          margin: base-line 0;

          li {
            border-left: calc(var(--base-line) * 0.16) solid var(--emphasis);
            padding-left: base-line * 0.5;
            margin-bottom: base-line * 0.25;
            font-size: smaller;
          }
        }

        table {
          width: 100%;
          border-collapse: collapse;

          th {
            text-align: left;
            font-size: smaller;
            text-transform: uppercase;
            border-bottom: calc(var(--base-line) * 0.1) solid var(--emphasis);
            padding-bottom: base-line * 0.25;
          }

          td {
            padding: base-line * 0.4 0;
            border-bottom: calc(var(--base-line) * 0.05) solid var(--accent);
            vertical-align: top;
          }

          td:first-child {
            width: base-line * 7;
            white-space: nowrap;
          }

          td:last-child {
            width: base-line * 5;
            font-size: smaller;
          }

          tr[data-shadowed] {
            opacity: 0.7;

            td:first-child kbd {
              text-decoration: line-through;
            }
          }

          tr[data-unbound] {
            color: var(--accent);
          }

          small {
            display: block;
            font-size: smaller;
            color: var(--accent);
          }

          [data-ok] {
            color: var(--emphasis);
          }

          [data-none] {
            color: var(--accent);
          }
        }
      }
    }
  }
</style>
