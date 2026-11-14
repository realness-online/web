<template>
  <article itemscope itemtype="https://schema.org/Dataset" aria-label="Modules">
    <header aria-label="Modules">
      <hgroup>
        <h1><router-link to="/">Realness</router-link></h1>
        <p>Modules</p>
      </hgroup>
      <nav aria-label="Related">
        <router-link to="/planning">Plans</router-link>
        <router-link to="/planning/maps/ways-in">Ways in</router-link>
      </nav>
    </header>
    <p v-if="error" role="status">{{ error }}</p>
    <p v-else-if="loading" role="status">Loading</p>
    <template v-else>
      <section aria-label="About">
        <p>{{ data.intro }}</p>
        <details v-if="data.glossary?.length">
          <summary>Glossary</summary>
          <dl>
            <template v-for="entry in data.glossary" :key="entry.term">
              <dt>{{ entry.term }}</dt>
              <dd>{{ entry.detail }}</dd>
            </template>
          </dl>
        </details>
      </section>
      <form aria-label="Filters" @submit.prevent>
        <fieldset v-for="axis in axes" :key="axis.name">
          <legend>{{ axis.legend }}</legend>
          <label
            v-for="option in [{ value: '', label: 'all' }, ...axis.options]"
            :key="option.value">
            <input
              v-model="chosen[axis.name]"
              type="radio"
              :name="axis.name"
              :value="option.value" />
            {{ option.label }}
          </label>
        </fieldset>
        <fieldset>
          <legend>Rows</legend>
          <label>
            <input v-model="open_all" type="checkbox" />
            Open all
          </label>
        </fieldset>
      </form>
      <dl aria-label="Key">
        <div v-for="(text, fate) in data.fates" :key="fate" :data-fate="fate">
          <dt>{{ fate }}</dt>
          <dd>{{ fate }}: {{ text }}</dd>
        </div>
      </dl>
      <table>
        <thead>
          <tr>
            <th>Module</th>
            <th>Owns</th>
            <th>Runs</th>
            <th>Leans on</th>
            <th>Used by</th>
            <th>Overlap</th>
            <th>Fate</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groups" :key="group.section">
            <tr v-if="group.rows.length" class="section">
              <th colspan="7">{{ group.section }}</th>
            </tr>
            <template v-for="row in group.rows" :key="row.id">
              <tr class="row" :aria-expanded="String(is_open(row))">
                <th>
                  <button type="button" @click="toggle(row)">
                    {{ row.name }}
                  </button>
                  <small>{{ row.sub }}</small>
                </th>
                <td>
                  {{ row.owns }}<br />
                  <span v-for="tag in row.concerns" :key="tag" class="tag">{{
                    tag
                  }}</span>
                </td>
                <td>{{ row.runs }}</td>
                <td>{{ row.leans }}</td>
                <td>{{ row.used }}</td>
                <td>{{ row.overlap }}</td>
                <td class="fate" :data-fate="row.fate">{{ row.fate }}</td>
              </tr>
              <tr v-if="is_open(row)" class="detail">
                <td colspan="7">
                  <ul>
                    <li v-for="(note, index) in row.notes" :key="index">
                      {{ note }}
                    </li>
                  </ul>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
      <section aria-label="Notes">
        <details>
          <summary>Decisions, patterns, open questions</summary>
          <h2>Decisions so far</h2>
          <ul>
            <li v-for="decision in data.decisions" :key="decision">
              {{ decision }}
            </li>
          </ul>
          <h2>Patterns</h2>
          <ul>
            <li v-for="pattern in data.patterns" :key="pattern">
              {{ pattern }}
            </li>
          </ul>
          <h2>Open questions</h2>
          <ul>
            <li v-for="question in data.questions" :key="question">
              {{ question }}
            </li>
          </ul>
        </details>
      </section>
    </template>
  </article>
</template>

<script setup>
  import { computed, onMounted as on_mounted, reactive, ref, watch } from 'vue'
  import { current_user } from '@/utils/serverless'
  import { read_filters, write_filters } from '@/utils/url-filters'

  const data = ref({
    concerns: [],
    avatars: {},
    fates: {},
    modules: [],
    patterns: [],
    questions: []
  })
  const error = ref('')
  const loading = ref(true)
  const open_all = ref(false)
  const toggled = reactive(new Set())
  const chosen = reactive({ section: '', concern: '', avatar: '', fate: '' })

  const sections = computed(() => [
    ...new Set(data.value.modules.map(module => module.section))
  ])

  const axes = computed(() => [
    {
      name: 'section',
      legend: 'Section',
      options: sections.value.map(value => ({ value, label: value }))
    },
    {
      name: 'concern',
      legend: 'Concern',
      options: data.value.concerns.map(value => ({ value, label: value }))
    },
    {
      name: 'avatar',
      legend: 'Avatar',
      options: Object.entries(data.value.avatars).map(([value, label]) => ({
        value,
        label
      }))
    },
    {
      name: 'fate',
      legend: 'Fate',
      options: Object.keys(data.value.fates).map(value => ({
        value,
        label: value
      }))
    }
  ])

  const keeps = (module, axis, value) => {
    if (!value) return true
    if (axis === 'section') return module.section === value
    if (axis === 'concern') return module.concerns.includes(value)
    if (axis === 'avatar') return module.avatars.includes(value)
    return module.fate === value
  }

  const groups = computed(() =>
    sections.value.map(section => ({
      section,
      rows: data.value.modules.filter(
        module =>
          module.section === section &&
          keeps(module, 'section', chosen.section) &&
          keeps(module, 'concern', chosen.concern) &&
          keeps(module, 'avatar', chosen.avatar) &&
          keeps(module, 'fate', chosen.fate)
      )
    }))
  )

  const is_open = row => open_all.value !== toggled.has(row.id)

  const toggle = row => {
    if (toggled.has(row.id)) toggled.delete(row.id)
    else toggled.add(row.id)
  }

  on_mounted(async () => {
    const token = (await current_user.value?.getIdToken()) ?? null
    const response = await fetch('/v1/vault/maps?page=modules', {
      headers: token ? { authorization: `Bearer ${token}` } : {}
    })
    loading.value = false
    if (!response.ok) {
      error.value = 'Your modules map could not load.'
      return
    }
    const payload = await response.json()
    if (!payload?.map) {
      error.value = 'Your modules map could not load.'
      return
    }
    data.value = payload.map
    const saved = read_filters(location.search, [
      ...Object.keys(chosen),
      'open'
    ])
    for (const name of Object.keys(chosen)) chosen[name] = saved[name] ?? ''
    open_all.value = saved.open === '1'
    watch([chosen, open_all], () =>
      write_filters({ ...chosen, open: open_all.value })
    )
  })
</script>

<style lang="stylus">
  article[itemtype$='/Dataset'] {
    max-inline-size: 90rem;
    margin-inline: auto;
    padding-inline: var(--base-line);

    > header[aria-label] {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding-block: calc(var(--base-line) * 0.5);

      hgroup {
        display: flex;
        align-items: baseline;
        gap: calc(var(--base-line) * 0.5);
      }

      h1 {
        margin: 0;
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: -0.02em;

        a {
          color: var(--text);
          text-decoration: none;
        }
      }

      p {
        margin: 0;
        color: var(--muted-text);
        font-size: 0.75rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      nav {
        display: flex;
        gap: calc(var(--base-line) * 0.5);
        font-size: 0.75rem;

        a {
          color: var(--accent);
          text-decoration: none;
        }
      }
    }

    > p[role='status'] {
      padding-block: calc(var(--base-line) * 3);
      text-align: center;
    }

    > form {
      display: flex;
      flex-wrap: wrap;
      gap: var(--base-line);
      padding-block: var(--base-line);

      fieldset {
        display: flex;
        flex-wrap: wrap;
        gap: calc(var(--base-line) * 0.4);
        margin: 0;
        padding: 0;
        border: 0;
        font-size: 0.75rem;

        legend {
          color: var(--muted-text);
          text-transform: uppercase;
        }

        label {
          border: 1px solid var(--muted-text);
          padding: 0.15em 0.4em;

          &:has(input:checked) {
            border-color: var(--accent);
            color: var(--accent);
          }

          input {
            inline-size: 0;
            block-size: 0;
            margin: 0;
            opacity: 0;
          }
        }
      }
    }

    > dl[aria-label='Key'] {
      display: flex;
      flex-wrap: wrap;
      gap: calc(var(--base-line) * 0.5);
      font-size: 0.75rem;

      div {
        display: flex;
        gap: 0.3em;
      }

      dt {
        inline-size: 0.8em;
        block-size: 0.8em;
        align-self: center;
        border: 1px solid var(--muted-text);
      }

      dd {
        margin: 0;
        color: var(--muted-text);
      }
    }

    > aside[aria-label='Avatar profile'] {
      padding-block: var(--base-line);
      max-inline-size: 65ch;

      h2 {
        margin-block: 0 calc(var(--base-line) * 0.5);
        font-size: 1rem;
      }

      dt {
        font-weight: 700;
      }

      dd {
        margin-inline-start: 0;
      }
    }

    > table {
      inline-size: 100%;
      margin-block: var(--base-line);
      border-collapse: collapse;
      font-size: 0.8125rem;
      line-height: 1.4;
      text-align: start;

      th,
      td {
        padding: 0.4em 0.5em;
        border-block-end: 1px solid var(--muted-text);
        text-align: start;
        vertical-align: top;
      }

      thead th {
        color: var(--muted-text);
        font-size: 0.75rem;
        text-transform: uppercase;
      }

      tr.section th {
        padding-block-start: var(--base-line);
        font-weight: 800;
      }

      tr.row > th {
        font-weight: 400;

        button {
          display: block;
          font: inherit;
          font-weight: 700;
          padding: 0;
          background: none;
          border: 0;
          color: var(--text);
          text-align: start;
        }

        small {
          color: var(--muted-text);
          font-size: 0.75rem;
        }
      }

      td.dim {
        opacity: 0.25;
      }

      .tag {
        display: inline-block;
        margin-inline-end: 0.25em;
        color: var(--muted-text);
        font-size: 0.7rem;
      }

      td.fate[data-fate='keep'] {
        color: var(--accent);
      }

      td.fate[data-fate='merge'],
      td[data-status='gap'] {
        color: var(--emphasis);
      }

      td[data-status='broken'] {
        font-weight: 700;
      }
    }

    > section[aria-label='Notes'] {
      padding-block: calc(var(--base-line) * 2);
      max-inline-size: 65ch;
    }
  }
</style>
