<script setup>
  import { settled_token } from '@/utils/settled-user'
  import { default_country, parse_phone } from '@/utils/phone'
  import { me } from '@/utils/serverless'
  import { as_phone_number } from '@/use/people'
  import { HTTP } from '#root/lib/http.js'
  import { computed, ref, onMounted as mounted } from 'vue'

  defineOptions({ name: 'AsFieldsetOrgs' })

  /** Longest folder name an org may have. */
  const MAX_SLUG = 62

  /** @type {import('vue').Ref<{ name: string, title?: string, short?: string, url?: string, logo?: string, founder?: string, people?: { name: string, phone: string, role: string }[] }[]>} */
  const orgs = ref([])
  /** Only the network admin starts an org. */
  const admin = ref(false)
  const busy = ref(false)
  const error = ref('')
  /** @type {import('vue').Ref<string>} */
  const new_org = ref('')
  /** `+name` to the new member's name and phone. */
  const drafts = ref({})

  const my_phone = computed(() =>
    me.value?.id ? `+${as_phone_number(me.value.id)}` : ''
  )

  /** `(862) 253-5338` at home, `+44 20 7946 0958` abroad. */
  const shown = phone => {
    const parsed = parse_phone(phone, default_country)
    if (!parsed?.isValid()) return phone
    return parsed.country === default_country
      ? parsed.formatNational()
      : parsed.formatInternational()
  }

  /** `+share-more-stories` reads as `Share More Stories`. */
  const titled = name =>
    name
      .replace(/^\+/, '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

  /** The page's name, unless it is only the folder name. */
  const title_of = org =>
    org.title && org.title !== org.name ? org.title : titled(org.name)

  /** The org's logo, else its website's icon. */
  const logo_of = org =>
    org.logo ?? (org.url ? new URL('/favicon.ico', org.url).href : undefined)

  /** Only the founder adds people to an org. */
  const am_founder = org => !!my_phone.value && org.founder === my_phone.value

  /** `Family Fun` becomes the folder name `+family-fun`. */
  const slug_of = text =>
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_SLUG)

  const post = async (path, body) => {
    const token = await settled_token()
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    if (response.ok) return response.json()
    if (response.status === HTTP.FORBIDDEN)
      throw new Error('Only the founder may do that.')
    if (
      response.status === HTTP.CONFLICT ||
      response.status === HTTP.PRECONDITION_FAILED
    )
      throw new Error('That org changed. Try again.')
    throw new Error('That did not work. Try again.')
  }

  const load = async () => {
    const token = await settled_token()
    const response = await fetch('/v1/orgs', {
      headers: { authorization: `Bearer ${token}` }
    })
    if (!response.ok) return
    const answer = await response.json()
    orgs.value = answer.orgs
    admin.value = !!answer.admin
    drafts.value = Object.fromEntries(
      orgs.value.map(org => [org.name, { name: '', phone: '' }])
    )
  }

  const on_make_org = async () => {
    const name = slug_of(new_org.value)
    if (!name) {
      error.value = 'Give the org a name.'
      return
    }
    error.value = ''
    busy.value = true
    try {
      await post('/v1/orgs', {
        name: `+${name}`,
        founder_name: me.value?.name ?? ''
      })
      new_org.value = ''
      await load()
    } catch (caught) {
      error.value = caught.message
    } finally {
      busy.value = false
    }
  }

  const on_add_member = async org => {
    const draft = drafts.value[org.name]
    const parsed = parse_phone(draft.phone, default_country)
    if (!parsed?.isValid()) {
      error.value = 'That phone number is not valid.'
      return
    }
    error.value = ''
    busy.value = true
    try {
      await post(`/v1/orgs/${org.name}/members`, {
        add: [{ name: draft.name.trim(), phone: parsed.number }]
      })
      draft.name = ''
      draft.phone = ''
      await load()
    } catch (caught) {
      error.value = caught.message
    } finally {
      busy.value = false
    }
  }

  /** sh7: the org waiting for the founder to confirm the hand-over. */
  const handing = ref(null)
  const hand_dialog = ref(null)
  /** `+name` to the chosen member's phone. */
  const heirs = ref({})

  const members_of = org =>
    (org.people ?? []).filter(person => person.role === 'member')

  const heir_of = org =>
    members_of(org).find(person => person.phone === heirs.value[org.name])

  const on_ask_hand_over = org => {
    if (!heir_of(org)) return
    handing.value = org
    hand_dialog.value?.showModal()
  }

  const on_cancel_hand_over = () => {
    hand_dialog.value?.close()
    handing.value = null
  }

  const on_hand_over = async () => {
    const org = handing.value
    hand_dialog.value?.close()
    handing.value = null
    error.value = ''
    busy.value = true
    try {
      await post(`/v1/orgs/${org.name}/owner`, {
        phone: heirs.value[org.name],
        confirm: org.name
      })
      await load()
    } catch (caught) {
      error.value = caught.message
    } finally {
      busy.value = false
    }
  }

  mounted(load)
</script>

<template>
  <fieldset v-if="orgs.length || admin" id="orgs" data-preference>
    <h4 data-labeled>Orgs</h4>
    <article
      v-for="org in orgs"
      :key="org.name"
      itemscope
      itemtype="https://schema.org/Organization">
      <header>
        <img v-if="logo_of(org)" itemprop="logo" :src="logo_of(org)" alt="" />
        <h5 itemprop="name" :title="org.name">{{ title_of(org) }}</h5>
        <abbr v-if="org.short" itemprop="alternateName" :title="title_of(org)">
          {{ org.short }}
        </abbr>
      </header>
      <ul>
        <li
          v-for="person in org.people"
          :key="person.phone"
          :itemprop="person.role"
          itemscope
          itemtype="https://schema.org/Person">
          <span v-if="person.name" itemprop="name">{{ person.name }}</span>
          <data itemprop="telephone" :value="person.phone">
            {{ shown(person.phone) }}
          </data>
        </li>
      </ul>
      <form
        v-if="am_founder(org)"
        :id="`add-member-${org.name.slice(1)}`"
        @submit.prevent="on_add_member(org)">
        <label>
          Name
          <input autocomplete="name" v-model="drafts[org.name].name" />
        </label>
        <label>
          Phone
          <input
            type="tel"
            autocomplete="tel"
            required
            v-model="drafts[org.name].phone" />
        </label>
        <button :disabled="busy">Add member</button>
      </form>
      <form
        v-if="am_founder(org) && members_of(org).length"
        :id="`hand-over-${org.name.slice(1)}`"
        @submit.prevent="on_ask_hand_over(org)">
        <label>
          New owner
          <select required v-model="heirs[org.name]">
            <option
              v-for="person in members_of(org)"
              :key="person.phone"
              :value="person.phone">
              {{ person.name || shown(person.phone) }}
            </option>
          </select>
        </label>
        <button :disabled="busy">Hand over</button>
      </form>
    </article>
    <dialog id="confirm-hand-over" ref="hand_dialog" data-modal>
      <p v-if="handing">
        Give {{ title_of(handing) }} to
        {{ heir_of(handing)?.name || shown(heir_of(handing)?.phone ?? '') }}?
        You lose access.
      </p>
      <menu>
        <button type="button" @click="on_cancel_hand_over">Cancel</button>
        <button type="button" id="confirm" @click="on_hand_over">
          Hand over
        </button>
      </menu>
    </dialog>
    <form v-if="admin" id="new-org" @submit.prevent="on_make_org">
      <label>
        New org
        <input required v-model="new_org" />
      </label>
      <button :disabled="busy">Make org</button>
    </form>
    <p v-if="error" data-hint>{{ error }}</p>
  </fieldset>
</template>

<style>
  dialog#confirm-hand-over {
    & > p {
      margin: 0;
    }

    & > menu {
      display: flex;
      justify-content: flex-end;
      gap: var(--base-line);
      margin-top: calc(var(--base-line) * 1.5);

      & > button#confirm {
        color: var(--emphasis);
      }
    }
  }

  fieldset#orgs {
    & > article {
      margin-block-start: var(--base-line);

      & > header {
        display: flex;
        align-items: center;
        gap: calc(var(--base-line) * 0.5);

        & > img {
          width: var(--base-line);
          height: var(--base-line);
        }

        & > h5 {
          margin: 0;
        }
      }

      & > ul {
        list-style: none;
        padding: 0;

        & > li {
          display: flex;
          gap: calc(var(--base-line) * 0.5);

          &[itemprop='founder'] {
            color: var(--accent);
          }
        }
      }
    }

    & > article > form,
    & > form#new-org {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: calc(var(--base-line) * 0.5);
      margin-block-start: calc(var(--base-line) * 0.5);

      & > label {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
      }

      & > button {
        margin-inline-start: 0;
      }
    }
  }
</style>
