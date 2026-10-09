import { current_user } from '@/utils/serverless'
import { home_view } from '@/utils/preference'
import { computed, ref } from 'vue'

/* The homepage shows thoughts, chat, and the TUI: each alone, or chat on the
   left with thoughts or the TUI on the right. Chat and the TUI need sign-in;
   the TUI and two columns need a display-wide screen. */

// display-begins in base-line.styl; the styles gate on the same width.
export const DISPLAY_BEGINS = '(min-width: 80rem)'

/** Option+1 to Option+5 pick them directly. */
export const HOME_VIEWS = [
  'thoughts',
  'chat-thoughts',
  'chat',
  'chat-tui',
  'tui'
]
const NARROW_VIEWS = ['thoughts', 'chat']

/** Option+C: chat in or out, beside whatever else is showing. */
const WITH_OR_WITHOUT_CHAT = {
  thoughts: 'chat-thoughts',
  'chat-thoughts': 'thoughts',
  chat: 'thoughts',
  'chat-tui': 'tui',
  tui: 'chat-tui'
}

const wide = ref(false)
let measuring = false
const measure = () => {
  if (measuring || typeof window === 'undefined' || !window.matchMedia) return
  measuring = true
  const query = window.matchMedia(DISPLAY_BEGINS)
  wide.value = query.matches
  query.addEventListener?.('change', event => {
    wide.value = event.matches
  })
}

/** A wanted view as this screen can show it. */
export const fit_view = (wanted, is_wide) => {
  const view = String(wanted ?? '')
  if (is_wide) return HOME_VIEWS.includes(view) ? view : 'thoughts'
  return view.startsWith('chat') ? 'chat' : 'thoughts'
}

export const use_home_view = () => {
  measure()
  const signed_in = computed(() => Boolean(current_user.value))
  const views = computed(() => {
    if (!signed_in.value) return ['thoughts']
    return wide.value ? HOME_VIEWS : NARROW_VIEWS
  })
  const view = computed(() =>
    signed_in.value ? fit_view(home_view.value, wide.value) : 'thoughts'
  )
  const shows = computed(() => ({
    thoughts: view.value === 'thoughts' || view.value === 'chat-thoughts',
    chat: view.value.startsWith('chat'),
    tui: view.value.endsWith('tui')
  }))
  const set_view = wanted => {
    home_view.value = wanted
  }
  const toggle_chat = () => set_view(WITH_OR_WITHOUT_CHAT[view.value])
  /** Beside chat, thoughts or the terminal. */
  const toggle_side = () =>
    set_view(view.value === 'chat-tui' ? 'chat-thoughts' : 'chat-tui')

  return { view, views, shows, wide, set_view, toggle_chat, toggle_side }
}
