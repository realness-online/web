<script setup>
  import AsFieldsetNotifications from '@/components/account/as-fieldset-notifications'
  import NameAsForm from '@/components/profile/as-form-name'
  import AsSignOn from '@/components/profile/as-sign-on'
  import Preference from '@/components/preference'
  import {
    sync_folder_supported,
    use as use_sync_folder,
    detect_brave
  } from '@/use/sync-folder'
  import { useRoute as use_route, useRouter as use_router } from 'vue-router'
  import { use_me } from '@/use/people'
  import { current_user } from '@/utils/serverless'
  import { sign_off } from '@/utils/serverless-auth'
  import { ref, computed, onMounted as mounted } from 'vue'

  defineOptions({ name: 'Account' })

  const route = use_route()
  const router = use_router()
  const { is_valid_name } = use_me()
  const sync_folder_supported_value = sync_folder_supported()
  const {
    choose_folder,
    sync_now,
    sync_folder_name,
    folder_sync_status,
    folder_sync_last_at,
    folder_sync_error,
    folder_sync_progress
  } = use_sync_folder()

  const is_brave = ref(false)
  mounted(async () => {
    if (!sync_folder_supported_value) is_brave.value = await detect_brave()
  })

  const sync_status_label = computed(() => {
    if (folder_sync_status.value === 'syncing') {
      const { current, total, label, detail } = folder_sync_progress.value
      if (detail?.includes('older thoughts soon')) return detail
      if (total > 0 && label)
        return `${current} of ${total}: ${label}${detail ? ` — ${detail}` : ''}`
      if (total > 0)
        return `Syncing ${current} of ${total}${detail ? ` — ${detail}` : ''}`
      return detail || 'Syncing…'
    }
    if (folder_sync_status.value === 'needs_permission')
      return 'Re-authorize folder'
    if (folder_sync_status.value === 'error')
      return folder_sync_error.value
        ? `Sync failed: ${folder_sync_error.value}`
        : 'Sync failed'
    if (folder_sync_last_at.value) {
      const when = new Date(folder_sync_last_at.value)
      if (!Number.isNaN(when.getTime()))
        return `Last synced ${when.toLocaleString()}`
    }
    return 'Mirror your thoughts to a folder'
  })

  const brave_help = ref(null)
  const on_show_brave_help = () => brave_help.value?.showModal()
  const on_close_brave_help = () => brave_help.value?.close()

  /** `undefined` means auth has not resolved yet; `null` means signed out. */
  const auth_resolved = computed(() => current_user.value !== undefined)
  const signed_in = computed(() => !!current_user.value && is_valid_name.value)

  const on_signed_in = () => {
    const next = route.query?.next
    if (typeof next === 'string' && next.startsWith('/')) router.replace(next)
  }

  const confirm = ref(null)
  const on_ask_sign_out = () => confirm.value?.showModal()
  const on_cancel_sign_out = () => confirm.value?.close()
  const on_do_sign_out = () => {
    confirm.value?.close()
    sign_off()
  }
</script>

<template>
  <section id="account" data-page>
    <div>
      <name-as-form v-if="signed_in" />
      <as-sign-on v-else-if="auth_resolved" @signed_in="on_signed_in" />

      <section itemprop="preferences">
        <as-fieldset-notifications v-if="signed_in" />
        <preference
          name="sync_folder"
          label="Sync folder"
          :disabled="!sync_folder_supported_value">
          <div data-row>
            <p>{{ sync_status_label }}</p>
            <button
              type="button"
              :disabled="!sync_folder_supported_value"
              :data-synced="sync_folder_name || undefined"
              @click="choose_folder">
              {{ sync_folder_name || 'Choose folder' }}
            </button>
            <button
              type="button"
              :disabled="!sync_folder_supported_value || !sync_folder_name"
              @click="sync_now">
              Sync now
            </button>
          </div>
          <p v-if="is_brave" data-hint>
            Brave disables this by default.
            <button type="button" @click="on_show_brave_help">
              How to enable
            </button>
          </p>
          <p v-else-if="!sync_folder_supported_value" data-hint>
            Not supported in this browser.
          </p>
          <preference
            compact
            name="sync_svg"
            label="SVG"
            :disabled="!sync_folder_supported_value" />
        </preference>
      </section>

      <footer v-if="signed_in">
        <fieldset>
          <div>
            <h4>Signed in</h4>
            <button type="button" id="sign-out" @click="on_ask_sign_out">
              Sign out
            </button>
          </div>
        </fieldset>
      </footer>

      <dialog id="confirm-sign-out" ref="confirm" data-modal>
        <p>Sign out?</p>
        <menu>
          <button type="button" @click="on_cancel_sign_out">Cancel</button>
          <button type="button" id="confirm" @click="on_do_sign_out">
            Sign out
          </button>
        </menu>
      </dialog>

      <dialog id="brave-sync-folder-help" ref="brave_help" data-modal>
        <p>Brave disables the File System Access API by default.</p>
        <ol>
          <li>Go to <code>brave://flags/#file-system-access-api</code></li>
          <li>Set "File System Access API" to Enabled</li>
          <li>Relaunch Brave</li>
        </ol>
        <menu>
          <button type="button" @click="on_close_brave_help">Close</button>
        </menu>
      </dialog>
    </div>
  </section>
</template>

<style>
  section#account[data-page] {
    & > div {
      max-width: calc(var(--base-line) * 48);
      margin-inline: auto;
      padding-inline: var(--base-line);
      padding-bottom: calc(var(--base-line) * 4);

      & > section[itemprop='preferences'] {
        [data-row] {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: calc(var(--base-line) * 0.5);

          & > p {
            margin: 0;
            flex: 1 1 auto;
          }

          & > button {
            margin-inline-start: 0;

            &[data-synced] {
              color: var(--accent);
            }
          }
        }

        p[data-hint] > button {
          color: var(--accent);
          text-decoration: underline;
          padding: 0;
        }
      }

      & > footer {
        & > fieldset {
          margin: 0;

          & > div {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: calc(var(--base-line) * 0.5);

            & > h4 {
              margin: 0;
              font-size: normal;
              font-weight: 300;
            }
          }
        }
      }

      & > dialog#confirm-sign-out {
        border: none;
        padding: calc(var(--base-line) * 1.5);

        & > p {
          margin: 0;
        }

        &::backdrop {
          background: var(--basalt-transparent);
        }

        & > menu {
          display: flex;
          justify-content: flex-end;
          gap: var(--base-line);
          margin-top: calc(var(--base-line) * 1.5);

          & > button {
            padding: var(--base-line);
            white-space: nowrap;
          }

          & > button#confirm {
            color: var(--emphasis);
          }
        }
      }

      & > dialog#brave-sync-folder-help {
        border: none;
        padding: calc(var(--base-line) * 1.5);

        & > p {
          margin: 0;
        }

        & > ol {
          margin: var(--base-line) 0 0;
          padding-inline-start: var(--base-line);

          code {
            font-size: smaller;
          }
        }

        &::backdrop {
          background: var(--basalt-transparent);
        }

        & > menu {
          display: flex;
          justify-content: flex-end;
          margin-top: calc(var(--base-line) * 1.5);

          & > button {
            padding: var(--base-line);
            white-space: nowrap;
          }
        }
      }
    }
  }
</style>
