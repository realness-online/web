<script setup>
  import { ref, nextTick as tick, watch } from 'vue'
  import { defineAsyncComponent as define_async_component } from 'vue'
  const InstallGuide = define_async_component(
    () => import('@/components/install-guide.vue')
  )
  const PreferencesMenu = define_async_component(
    () => import('@/components/preferences-menu.vue')
  )
  import { reset_preferences } from '@/utils/preference'
  import { documentation_html_parts } from '@/utils/markdown'
  import { documentation_toc } from '@/prerender/toc'

  const dialog = ref(null)
  const before_ref = ref(null)
  const after_ref = ref(null)
  const toc_items = ref(documentation_toc)
  const { before, after, has_install_guide } = documentation_html_parts()
  const show_guide = ref(false)

  const mount_content = () => {
    if (before_ref.value) before_ref.value.innerHTML = before
    if (after_ref.value) after_ref.value.innerHTML = after
  }

  const show_modal = async () => {
    if (!dialog.value) return
    if (dialog.value.open) dialog.value.close()
    else {
      dialog.value.showModal()
      show_guide.value = true
      await tick()
      mount_content()
    }
  }

  const on_click = event => {
    if (event.target === dialog.value) dialog.value.close()
  }

  const on_scroll_to_section = id => {
    const element = document.getElementById(id)
    if (element) element.scrollIntoView({ behavior: 'smooth' })
  }

  watch([() => before, () => after], () => {
    if (dialog.value?.open) mount_content()
  })

  defineExpose({ show: show_modal })
</script>

<template>
  <dialog ref="dialog" id="documentation" @click="on_click">
    <header>
      <h1>Realness.<span>online</span></h1>
      <h2>Documentation</h2>
    </header>
    <article>
      <nav v-if="toc_items.length > 0" aria-label="Table of contents">
        <a
          v-for="item in toc_items"
          :key="item.id"
          :href="`#${item.id}`"
          :data-level="item.level"
          @click.prevent="on_scroll_to_section(item.id)">
          {{ item.title }}
        </a>
      </nav>
      <!-- Manual innerHTML avoids Safari dialog+v-html bug -->
      <section ref="before_ref" itemprop="content" />
      <install-guide v-if="has_install_guide && show_guide" />
      <section ref="after_ref" itemprop="content" />
      <section itemprop="preferences">
        <header>
          <h2 id="preferences">Preferences</h2>
          <p>
            Layers, geology, motion, 3D atmosphere - every poster responds to
            what you turn on. Reset everything to start clean.
          </p>
          <button type="button" @click="reset_preferences">Reset</button>
        </header>
        <preferences-menu icon />
      </section>
    </article>
  </dialog>
</template>

<style lang="stylus">
  dialog#documentation {
    & > header {
      h1 {
        margin-top: base-line* 2;
        margin-right: base-line;
        text-align: center;
        color: var(--accent);
        span {
          font-size: smaller;
          color: var(--accent);
        }
      }
      h2 {
        text-align: center;
        color: var(--emphasis);
      }
    }
    & > article {
      max-width: var(--page-width);
      max-height: 80vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      &:focus {
        outline: none;
      }
      & > header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: base-line;
        h1 {
          color: var(--emphasis);
        }
        & > a {
          cursor: pointer;
          & > svg[data-icon='remove'] {
            fill: var(--text);
            width: base-line;
            height: base-line;
            &:hover {
              fill: var(--emphasis);
            }
          }
        }
      }

      & > nav[aria-label='Table of contents'] {
        display: block;
        column-width: 166px;
        column-gap: base-line;
        column-fill: balance;
        column-rule: 1px solid var(--emphasis);
        padding-left: base-line * 1.33;
        margin-bottom: base-line * 2;
        & > a {
          display: block;
          font-size: smaller;
          color: var(--accent);
          text-decoration: none;
          break-inside: avoid;
          line-height: 1.66;
          text-align: left;

          &:hover {
            color: var(--emphasis);
          }

          // Level 3 and deeper get indentation
          &[data-level='3'] {
            padding-left: base-line * 0.11;
            line-height: 1.33;
            font-size: 0.66em;
            &:before {
              content: '-';
              margin-right: base-line * 0.11;
            }
          }

          &[data-level='4'] {
            padding-left: base-line * 0.66;
            font-size: 0.85em;
          }

          &[data-level='5'] {
            padding-left: base-line * 0.66;
            font-size: 0.8em;
          }

          &[data-level='6'] {
            padding-left: base-line * 0.66;
            font-size: 0.75em;
          }
        }
      }

      & > section[itemprop='content'],
      & > section[aria-label='Install Realness'] {
        min-width: 0;
        max-width: 100%;
        padding: 0 base-line * .5;
      }

      & > section[itemprop='preferences'] {
        padding: 0 base-line * 0.5 base-line * 2;
        border-top: 1px solid var(--emphasis);

        & > header {
          margin-bottom: base-line;

          & > h2 {
            color: var(--emphasis);
            margin-top: base-line * 2;
          }

          & > p {
            margin-bottom: base-line * 2;
            line-height: 1.66;
          }

          & > button {
            display: block;
            padding: base-line * 0.5 base-line * 2;
            border: 1px solid var(--emphasis);
            border-radius: base-line * 0.33;
            background: none;
            color: var(--emphasis);
            cursor: pointer;
            font: inherit;

            &:hover,
            &:focus-visible {
              background: var(--emphasis);
              color: var(--contrast);
            }
          }
        }
      }
    }
  }
</style>
