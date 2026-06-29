<script setup>
  import { ref, nextTick, watch } from 'vue'
  import InstallGuide from '@/components/install-guide.vue'
  import PreferencesMenu from '@/components/preferences-menu'
  import { reset_preferences } from '@/utils/preference'
  import { documentation_html_parts, documentation_toc } from '@/utils/markdown'

  const dialog = ref(null)
  const before_ref = ref(null)
  const after_ref = ref(null)
  const toc_items = ref(documentation_toc())
  const { before, after, has_install_guide } = documentation_html_parts()

  const mount_content = () => {
    if (before_ref.value) before_ref.value.innerHTML = before
    if (after_ref.value) after_ref.value.innerHTML = after
  }

  const show_modal = async () => {
    if (!dialog.value) return
    if (dialog.value.open) dialog.value.close()
    else {
      dialog.value.showModal()
      await nextTick()
      mount_content()
    }
  }

  const handle_click = event => {
    if (event.target === dialog.value) dialog.value.close()
  }

  const scroll_to_section = id => {
    const element = document.getElementById(id)
    if (element) element.scrollIntoView({ behavior: 'smooth' })
  }

  watch([() => before, () => after], () => {
    if (dialog.value?.open) mount_content()
  })

  defineExpose({ show: show_modal })
</script>

<template>
  <dialog ref="dialog" class="documentation" @click="handle_click">
    <header>
      <h1>Realness.<span>online</span></h1>
      <h2>Documentation</h2>
    </header>
    <article>
      <nav v-if="toc_items.length > 0" class="toc">
        <a
          v-for="item in toc_items"
          :key="item.id"
          :href="`#${item.id}`"
          :class="`level-${item.level}`"
          @click="scroll_to_section(item.id)">
          {{ item.title }}
        </a>
      </nav>
      <!-- Markdown before/after install guide: manual innerHTML avoids Safari dialog+v-html bug -->
      <section class="content">
        <div ref="before_ref" />
        <install-guide v-if="has_install_guide" />
        <div ref="after_ref" />
      </section>
      <section class="preferences-panel">
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
  @require '../style/mixins/markdown-content.styl'

  dialog.documentation {
    & > header {
      h1 {
        margin-top: base-line* 2;
        margin-right: base-line;
        text-align: center;
        color: blue;
        span {
          font-size: smaller;
          color: blue;
        }
      }
      h2 {
        text-align: center;
        color: red;
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
          color: var(--red);
        }
        & > a {
          cursor: pointer;
          & > svg.remove {
            fill: var(--text);
            width: base-line;
            height: base-line;
            &:hover {
              fill: var(--red);
            }
          }
        }
      }

      & > nav.toc {
        display: block;
        column-width: 166px;
        column-gap: base-line;
        column-fill: balance;
        column-rule: 1px solid var(--red);
        padding-left: base-line * 1.33;
        margin-bottom: base-line * 2;
        & > a {
          display: block;
          font-size: smaller;
          margin: round((base-line / 4), 2) 0;
          color: var(--blue);
          text-decoration: none;
          break-inside: avoid;
          line-height: 1.66;
          text-align: left;

          &:hover {
            color: var(--red);
          }

          // Level 3 and deeper get indentation
          &.level-3 {
            padding-left: base-line * 0.11;
            line-height: 1.33;
            font-size: 0.66em;
            &:before {
              content: '-';
              margin-right: base-line * 0.11;
            }
          }

          &.level-4 {
            padding-left: base-line * 0.66;
            font-size: 0.85em;
          }

          &.level-5 {
            padding-left: base-line * 0.66;
            font-size: 0.8em;
          }

          &.level-6 {
            padding-left: base-line * 0.66;
            font-size: 0.75em;
          }
        }
      }

      & > section.content {
        flex: 1;
        min-width: 0;
        max-width: 100%;
        padding: 0 base-line * .5;

        & > div {
          markdown_content();
        }
      }

      & > section.preferences-panel {
        padding: 0 base-line * 0.5 base-line * 2;
        border-top: 1px solid var(--red);

        & > header {
          margin-bottom: base-line;

          & > h2 {
            color: var(--red);
            margin-top: base-line * 2;
            margin-bottom: base-line;
          }

          & > p {
            margin-bottom: base-line * 2;
            line-height: 1.66;
          }

          & > button {
            display: block;
            padding: base-line * 0.5 base-line * 2;
            border: 1px solid var(--red);
            border-radius: base-line * 0.33;
            background: none;
            color: var(--red);
            cursor: pointer;
            font: inherit;

            &:hover,
            &:focus-visible {
              background: var(--red);
              color: white;
            }
          }
        }
      }
    }
  }
</style>
