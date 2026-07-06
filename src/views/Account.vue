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

  // Signed in AND named: anything short of that is still "signing in", which
  // as-sign-on owns (phone form, then the name gate). One source of truth.
  const signed_in = computed(() => !!current_user.value && is_valid_name.value)

  const on_signed_in = () => {
    const next = route.query?.next
    if (typeof next === 'string' && next.startsWith('/')) router.replace(next)
  }

  // Sign out is destructive enough to confirm — no one-tap logout.
  const confirm = ref(null)
  const ask_sign_out = () => confirm.value?.showModal()
  const cancel_sign_out = () => confirm.value?.close()
  const do_sign_out = () => {
    confirm.value?.close()
    sign_off()
  }
</script>

<template>
  <section id="account" class="page">
    <div class="body">
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
            <button type="button" id="sign-out" @click="ask_sign_out">
              Sign out
            </button>
          </div>
        </footer>
      </template>

      <as-sign-on v-else @signed_in="on_signed_in" />

      <dialog id="confirm-sign-out" ref="confirm" class="modal">
        <p>Sign out?</p>
        <menu>
          <button type="button" @click="cancel_sign_out">Cancel</button>
          <button type="button" id="confirm" @click="do_sign_out">
            Sign out
          </button>
        </menu>
      </dialog>
    </div>
  </section>
</template>

<style lang="stylus">
  section#account.page {
    & > div.body {
      max-width: page-width-large;
      margin: 0 auto;
      padding: 0 base-line base-line * 4;
      & > address {
        margin-bottom: base-line;
      }
      & > form {
        max-width: base-line * 14;
        margin-bottom: base-line;
      }
      & > section[itemprop='preferences'] {
        margin-top: base-line * 2;
        padding-top: base-line;
        border-top: 1px solid var(--accent);
        & > header > h2 {
          color: var(--emphasis);
          margin: 0 0 base-line;
          font-weight: 300;
        }
        & > menu.preferences-menu {
          margin: 0;
        }
      }
      & > footer {
        padding: base-line 0;
        border-top: 1px solid var(--accent);
        & > div {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: base-line * 0.5;
          & > h4 {
            margin: 0;
            font-size: normal;
            font-weight: 300;
          }
          & > button#sign-out {
            color: var(--emphasis);
          }
        }
      }
      & > dialog#confirm-sign-out {
        border: none;
        padding: base-line * 1.5;
        & > p {
          margin: 0;
        }
        &::backdrop {
          background: var(--basalt-transparent);
        }
        & > menu {
          display: flex;
          justify-content: flex-end;
          gap: base-line;
          margin: base-line * 1.5 0 0;
          padding: 0;
          & > button {
            padding: base-line * 0.5 base-line;
            white-space: nowrap;
          }
          & > button#confirm {
            color: var(--emphasis);
          }
        }
      }
    }
  }
</style>
