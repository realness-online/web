<script setup>
  import { use_install } from '@/use/install'
  import { all_methods } from '@/utils/platform'

  const { method, installed, can_install, prompt_install } = use_install()

  /** @param {string} name */
  const src = name => `/install/${name}.mp4`
</script>

<template>
  <section aria-label="Install Realness">
    <p v-if="installed" role="status">
      <strong>Realness is installed.</strong>
      Open it from your home screen or dock.
    </p>

    <template v-else>
      <header>
        <h3>Add Realness to your {{ method.noun }}</h3>
        <p>
          Works like a native app, straight from the web.
          <small>{{ method.label }}</small>
        </p>
      </header>

      <figure
        v-if="method.video"
        :data-portrait="
          method.video === 'ios-safari' || method.video === 'android-chrome'
        ">
        <video :src="src(method.video)" autoplay loop muted playsinline />
      </figure>

      <p v-else role="alert">
        Firefox can't install web apps on the desktop. Open Realness in
        <strong>Chrome</strong>, <strong>Edge</strong>, <strong>Brave</strong>,
        or <strong>Safari</strong> — or add a bookmark.
      </p>

      <button v-if="can_install" type="button" @click="prompt_install">
        Install Realness
      </button>

      <details>
        <summary>Other devices</summary>
        <ul>
          <li
            v-for="other in all_methods"
            :key="other.video"
            :data-portrait="other.portrait">
            <h4>{{ other.label }}</h4>
            <video
              :src="src(other.video)"
              muted
              loop
              playsinline
              controls
              preload="none" />
          </li>
        </ul>
      </details>
    </template>
  </section>
</template>

<style lang="stylus">
  dialog#install {
    width: min(92vw, base-line * 28);
    max-height: 88vh;
    overflow-y: auto;

    & > article {
      position: relative;
      padding: base-line (base-line * 0.5);

      & > button {
        position: absolute;
        top: 0;
        right: 0;
        cursor: pointer;
        line-height: 0;
        padding: 0;
        border: none;
        background: none;

        & > svg.icon {
          width: base-line;
          height: base-line;
          fill: var(--text);

          &:hover {
            fill: var(--emphasis);
          }
        }
      }
    }
  }

  section[aria-label='Install Realness'] {
    margin-inline: auto;
    max-width: base-line * 26;
    padding: base-line 0;
    text-align: center;

    & > header {
      margin-bottom: base-line;
      h3 {
        margin: 0;
        color: var(--accent);
      }
      p {
        margin: 0 auto;
        small {
          display: block;
          color: var(--emphasis);
        }
      }
    }

    figure {
      margin-inline: auto;
      border-radius: base-line;
      overflow: hidden;
      box-shadow: 0 (base-line) (base-line * 2) unquote('color-mix(in srgb, var(--graphite) 45%, transparent)');
      video {
        display: block;
        width: 100%;
        height: auto;
      }
      &[data-portrait='true'] {
        max-width: base-line * 15;
      }
      &[data-portrait='false'] {
        max-width: base-line * 26;
      }
    }

    p[role='status'] {
      color: var(--accent);
      strong {
        color: var(--accent);
      }
    }

    p[role='alert'] {
      max-width: base-line * 22;
      margin: 0 auto;
      strong {
        color: var(--accent);
      }
    }

    & > button {
      margin: base-line auto 0;
      padding: base-line (base-line * 1.5);
      border-radius: base-line * 2;
      border: none;
      font-size: inherit;
      cursor: pointer;
      background-color: var(--accent);
      color: var(--surface);
      -webkit-tap-highlight-color: var(--accent);
      @media (prefers-color-scheme: dark) {
        color: var(--bone);
      }
    }

    details {
      margin-top: base-line * 1.5;
      text-align: left;
      summary {
        cursor: pointer;
        color: var(--accent);
        text-align: center;
      }
      ul {
        list-style: none;
        margin-top: base-line;
        display: grid;
        gap: base-line;
        @media (min-width: pad-begins) {
          grid-template-columns: 1fr 1fr;
        }
        li {
          h4 {
            margin-top: 0;
          }
          video {
            display: block;
            width: 100%;
            height: auto;
            border-radius: base-line * 0.5;
            background: var(--graphite);
          }
          &[data-portrait='true'] video {
            max-width: base-line * 11;
          }
        }
      }
    }
  }
</style>
