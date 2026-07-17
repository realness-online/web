<script setup>
import AsAddress from '@/components/profile/as-address'
import PreferencesMenu from '@/components/preferences-menu'
import NameAsForm from '@/components/profile/as-form-name'
import AsSignOn from '@/components/profile/as-sign-on'
import { useRoute as use_route, useRouter as use_router } from 'vue-router'
import { use_me } from '@/use/people'
import { current_user, me } from '@/utils/serverless'
import { sign_off } from '@/utils/serverless-auth'
import { ref, computed } from 'vue'

defineOptions({ name: 'Account' })

const route = use_route()
const router = use_router()
const { is_valid_name } = use_me()

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
      <template v-if="signed_in">
        <as-address :person="me" />
        <name-as-form />
        <section itemprop="preferences">
          <header>
            <h2 id="preferences">Preferences</h2>
          </header>
          <preferences-menu icon />
        </section>
        <footer>
          <div>
            <h4>Signed in</h4>
            <button type="button" id="sign-out" @click="on_ask_sign_out">
              Sign out
            </button>
          </div>
        </footer>
      </template>

      <as-sign-on v-else @signed_in="on_signed_in" />

      <dialog id="confirm-sign-out" ref="confirm" data-modal>
        <p>Sign out?</p>
        <menu>
          <button type="button" @click="on_cancel_sign_out">Cancel</button>
          <button type="button" id="confirm" @click="on_do_sign_out">
            Sign out
          </button>
        </menu>
      </dialog>
    </div>
  </section>
</template>

<style>
section#account[data-page] {
  &>div {
    max-width: calc(var(--base-line) * 48);
    margin-inline: auto;
    padding-inline: var(--base-line);
    padding-bottom: calc(var(--base-line) * 4);

    &>address {
      margin-bottom: var(--base-line);
    }

    &>form {
      max-width: calc(var(--base-line) * 14);
      margin-bottom: var(--base-line);
    }

    &>section[itemprop='preferences'] {
      margin-top: calc(var(--base-line) * 2);
      padding-top: var(--base-line);
      border-top: 1px solid var(--accent);

      &>header>h2 {
        color: var(--emphasis);
        margin-top: 0;
        font-weight: 300;
      }

      &>menu[data-preferences-menu] {
        margin: 0;
      }
    }

    &>footer {
      padding: var(--base-line) 0;
      border-top: 1px solid var(--accent);

      &>div {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: calc(var(--base-line) * 0.5);

        &>h4 {
          margin: 0;
          font-size: normal;
          font-weight: 300;
        }

        &>button#sign-out {
          color: var(--emphasis);
        }
      }
    }

    &>dialog#confirm-sign-out {
      border: none;
      padding: calc(var(--base-line) * 1.5);

      &>p {
        margin: 0;
      }

      &::backdrop {
        background: var(--basalt-transparent);
      }

      &>menu {
        display: flex;
        justify-content: flex-end;
        gap: var(--base-line);
        margin-top: calc(var(--base-line) * 1.5);

        &>button {
          padding: var(--base-line);
          white-space: nowrap;
        }

        &>button#confirm {
          color: var(--emphasis);
        }
      }
    }
  }
}
</style>
