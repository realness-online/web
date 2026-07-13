<script setup>
  import InstallGuide from '@/components/install-guide.vue'
  import PreferencesMenu from '@/components/preferences-menu'
  import { reset_preferences } from '@/utils/preference'
  import { documentation_html_parts, changelog_html } from '@/utils/markdown'
  import { documentation_toc } from '@/prerender/toc'
  import instance_prompt from '@/content/agent-prompt-instance.md?raw'
  import { onMounted, onUnmounted, ref, watch } from 'vue'
  import { useRouter as use_router } from 'vue-router'
  const router = use_router()

  const toc_items = documentation_toc
  const {
    before: install_before,
    after: install_after,
    realness: install_realness
  } = documentation_html_parts()
  const changelog_content = changelog_html()

  const copy_feedback_ms = 2000
  const copied = ref(false)

  const on_copy_prompt = async () => {
    try {
      await navigator.clipboard.writeText(instance_prompt)
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, copy_feedback_ms)
    } catch {
      // clipboard unavailable
    }
  }

  const ACTIVE_HEADING_VIEWPORT_RATIO = 0.33

  /** @param {MouseEvent} event */
  const on_content_click = event => {
    const link = event.target?.closest?.('a[href^="#"]')
    if (!link) return
    event.preventDefault()
    router.replace({ hash: link.getAttribute('href') })
  }

  const active_id = ref(null)
  const pick = () => {
    const content = document.querySelector(
      '.page.documentation section.content'
    )
    const headings = [
      ...(content?.querySelectorAll('h2[id], h3[id], h4[id], h5[id], h6[id]') ??
        [])
    ]
    const threshold = window.innerHeight * ACTIVE_HEADING_VIEWPORT_RATIO
    let closest = null,
      best = Infinity
    for (const h of headings) {
      const dist = Math.abs(h.getBoundingClientRect().top - threshold)
      if (dist < best) {
        best = dist
        closest = h
      }
    }
    if (closest) active_id.value = closest.id
  }

  watch(active_id, id => {
    if (!id) return
    const nav = document.querySelector('.page.documentation nav.toc')
    const link = nav?.querySelector(`a[href="#${CSS.escape(id)}"]`)
    if (!(nav instanceof HTMLElement) || !(link instanceof HTMLElement)) return
    // Keep the active link visible inside the sticky sidebar only. Never use
    // scrollIntoView here — it scrolls the window too, fighting the page's own
    // scroll to the clicked heading and forcing the page back to the top.
    // Only act when the sidebar itself overflows (desktop sticky layout).
    if (nav.scrollHeight <= nav.clientHeight) return
    const link_top = link.offsetTop
    const link_bottom = link_top + link.offsetHeight
    if (link_top < nav.scrollTop) nav.scrollTop = link_top
    else if (link_bottom > nav.scrollTop + nav.clientHeight)
      nav.scrollTop = link_bottom - nav.clientHeight
  })

  onMounted(() => {
    window.addEventListener('scroll', pick, { passive: true })
    pick()
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', pick)
  })
</script>

<template>
  <section id="docs" class="page documentation" lang="en">
    <header>
      <h1>Documentation</h1>
    </header>
    <article>
      <nav v-if="toc_items.length" class="toc" aria-label="Table of contents">
        <router-link
          v-for="item in toc_items"
          :key="item.id"
          :to="`#${item.id}`"
          replace
          :class="[`level-${item.level}`, { active: item.id === active_id }]">
          {{ item.title }}
        </router-link>
      </nav>
      <section class="content">
        <div v-html="install_before" @click="on_content_click" />
        <install-guide />
        <div v-html="install_after" />
        <section v-if="install_realness" class="realness-of-your-own">
          <button type="button" class="copy-prompt" @click="on_copy_prompt">
            {{ copied ? 'Copied' : 'Copy prompt' }}
          </button>
          <div v-html="install_realness" />
        </section>
        <section class="preferences-panel">
          <header>
            <button type="button" @click="reset_preferences">Reset</button>
            <h2 id="preferences">Preferences</h2>
            <p>
              Layers, geology, motion, 3D atmosphere - every poster responds to
              what you turn on. Reset everything to start clean.
            </p>
          </header>
          <preferences-menu icon />
        </section>
        <section class="changelog-panel">
          <h2 id="changelog">Changelog</h2>
          <div v-html="changelog_content" />
        </section>
      </section>
    </article>
  </section>
</template>

<style lang="stylus">
  @require '../style/mixins/markdown-content.styl'

  section.page.documentation {
    margin: 0 auto;
    padding: 0 base-line;
    max-width: support-page-width;

    & > header {
      display: block;
      padding: 0;
      margin-bottom: base-line * 2;

      h1 {
        margin-top: 0;
        text-align: center;
        color: var(--emphasis);
      }
    }

    & > article {
      display: block;

      @media (min-width: pad-begins) {
        display: grid;
        grid-template-columns: (base-line * 10) minmax(0, 1fr);
        gap: base-line * 1.5;
        align-items: start;
      }

      & > nav.toc {
        display: block;
        column-width: base-line * 8;
        column-gap: base-line;
        column-fill: balance;
        column-rule: 1px solid var(--emphasis);
        margin-bottom: base-line * 2;

        @media (min-width: pad-begins) {
          column-width: auto;
          column-count: 1;
          column-rule: none;
          padding-right: base-line * 0.75;
          margin-bottom: 0;
          position: sticky;
          top: base-line;
          max-height: calc(100dvh - var(--base-line) * 4);
          overflow-y: auto;
          border-right: 1px solid var(--emphasis);
        }

        & > a {
          display: block;
          margin: round((base-line / 4), 2) 0;
          color: var(--accent);
          text-decoration: none;
          break-inside: avoid;
          line-height: 1.66;
          transition: color 150ms ease;
          touch-action: manipulation;

          &:hover,
          &.active {
            color: var(--emphasis);
          }

          &.level-3 {
            padding-left: base-line * 0.11;
            line-height: 1.33;
            font-size: smaller;

            &:before {
              content: '-';
              margin-right: base-line * 0.11;
            }
          }

          &.level-4,
          &.level-5,
          &.level-6 {
            padding-left: base-line * 0.66;
            line-height: 1.33;
            font-size: smaller;

            &:before {
              content: '-';
              margin-right: base-line * 0.11;
            }
          }
        }
      }

      & > section.content {
        min-width: 0;
        padding: 0 base-line * 0.5;

        & > div {
          min-width: 0;
          max-width: 100%;
          markdown_content();
        }

        & > section.install.guide {
          margin-top: base-line;
        }

        & > section.realness-of-your-own {
          margin-top: base-line * 3;

          & > div {
            min-width: 0;
            max-width: 100%;
            markdown_content();
          }

          & > button.copy-prompt {
            float: right;
            margin-left: base-line;
            padding: base-line * 0.33 base-line;
            border: 1px solid var(--emphasis);
            border-radius: base-line * 0.33;
            background: none;
            color: var(--emphasis);
            cursor: pointer;
            font: inherit;

            &:hover,
            &:focus-visible {
              background: var(--emphasis);
              color: var(--on-emphasis);
            }
          }
        }

        & > section.preferences-panel {
          margin-top: base-line * 3;

          & > header {
            margin-bottom: base-line * 2;

            & > h2 {
              color: var(--emphasis);
              margin-bottom: base-line;
            }

            & > p {
              max-width: base-line * 28;
              margin-bottom: base-line * 2;
              line-height: 1.66;
            }

            & > button {
              float: right;
              margin-left: base-line;
              padding: base-line * 0.33 base-line;
              border: 1px solid var(--emphasis);
              border-radius: base-line * 0.33;
              background: none;
              color: var(--emphasis);
              cursor: pointer;
              font: inherit;

              &:hover,
              &:focus-visible {
                background: var(--emphasis);
                color: var(--on-emphasis);
              }
            }
          }
        }

        & > section.changelog-panel {
          margin-top: base-line * 3;

          & > h2 {
            color: var(--emphasis);
            margin-bottom: base-line;
          }

          & > div {
            min-width: 0;
            max-width: 100%;
            markdown_content();
          }
        }
      }
    }
  }
</style>
