/**
 * Every key command that works anywhere in the app: the preference toggles,
 * the cycles, the ui actions and the navigation. Registered against the
 * 'Global' context, which use_keymap adds on mount and drops on unmount.
 */

import { watch } from 'vue'
import { useMagicKeys } from '@vueuse/core'
import { useRouter as use_router } from 'vue-router'
import { use_keymap } from '@/use/key-commands'
import {
  ANIMATION_SPEEDS,
  ANIMATION_SPEED_LEGACY,
  DEFAULT_ANIMATION_SPEED
} from '@/utils/animation-config'
import {
  shadow,
  stroke,
  mosaic,
  drama,
  drama_back,
  drama_front,
  drama_last,
  bold,
  medium,
  regular,
  light,
  background,
  boulders,
  rocks,
  gravel,
  sand,
  sediment,
  animate,
  animation_speed,
  info,
  storytelling,
  grid,
  morph,
  aspect_ratio_mode,
  slice_alignment,
  menu,
  footer_visible,
  view_3d
} from '@/utils/preference'

const ASPECT_RATIOS = ['auto', '1/1', '1.618/1', '16/9', '2.35/1', '2.76/1']

/** Bottom to top. The ends do not wrap. */
const SLICE_ALIGNMENTS = ['ymin', 'ymid', 'ymax']

/**
 * drama_back, drama_front - the three stages a repeated press walks through.
 * Both on, then each light alone, then back to both. Turning drama off is what
 * Toggle_Drama is for, so the cycle never lands on nothing.
 */
const DRAMA_STAGES = [
  [true, true],
  [true, false],
  [false, true]
]

/**
 * @param {string[]} list
 * @param {string} current
 * @param {boolean} [backwards]
 * @returns {string} The next entry, wrapping at either end
 */
const next_in = (list, current, backwards = false) => {
  const step = backwards ? -1 : 1
  const at = list.indexOf(current)
  return list[(at + step + list.length) % list.length]
}

const apply_aspect_ratio = () =>
  document.documentElement.setAttribute(
    'data-aspect-ratio',
    aspect_ratio_mode.value || 'auto'
  )

/**
 * @param {Object} dialogs
 * @param {import('vue').Ref<any>} dialogs.documentation
 * @param {import('vue').Ref<any>} dialogs.preferences
 */
export const use_global_keymap = ({ documentation, preferences }) => {
  const router = use_router()
  const magic_keys = useMagicKeys()
  const { register, register_preference } = use_keymap('Global')

  /** Switching a master preference on brings all of its members with it. */
  const register_master = (command, master, members) =>
    register(command, () => {
      master.value = !master.value
      if (master.value) for (const member of members) member.value = true
    })

  register_master('pref::Toggle_Shadow', shadow, [
    bold,
    medium,
    regular,
    light,
    background
  ])
  register_master('pref::Toggle_Mosaic', mosaic, [
    boulders,
    rocks,
    gravel,
    sand,
    sediment
  ])

  register('pref::Toggle_Drama', () => {
    drama.value = !drama.value
    if (drama.value) {
      drama_back.value = drama_last.value !== 'front'
      drama_front.value = drama_last.value !== 'back'
      return
    }
    // Remember the combination so switching back on restores it.
    if (drama_back.value !== drama_front.value)
      drama_last.value = drama_back.value ? 'back' : 'front'
    else drama_last.value = 'both'
    drama_back.value = false
    drama_front.value = false
  })
  register('pref::Cycle_Drama', () => {
    const at = DRAMA_STAGES.findIndex(
      ([back, front]) =>
        back === drama_back.value && front === drama_front.value
    )
    const [back, front] = DRAMA_STAGES[(at + 1) % DRAMA_STAGES.length]
    drama_back.value = back
    drama_front.value = front
    drama.value = back || front
  })

  register('pref::Cycle_Animation_Speed', () => {
    const current =
      ANIMATION_SPEED_LEGACY[animation_speed.value] ||
      animation_speed.value ||
      DEFAULT_ANIMATION_SPEED
    animation_speed.value = next_in(ANIMATION_SPEEDS, current)
  })

  register('pref::Cycle_Aspect_Ratio', () => {
    const current = aspect_ratio_mode.value || 'auto'
    aspect_ratio_mode.value = next_in(
      ASPECT_RATIOS,
      current,
      magic_keys.shift.value
    )
    apply_aspect_ratio()
  })
  watch(aspect_ratio_mode, apply_aspect_ratio, { immediate: true })

  const step_slice_alignment = direction => {
    const at = SLICE_ALIGNMENTS.indexOf(slice_alignment.value || 'ymid')
    const next = SLICE_ALIGNMENTS[at + direction]
    if (next) slice_alignment.value = next
  }
  register('pref::Slice_Alignment_Up', () => step_slice_alignment(-1))
  register('pref::Slice_Alignment_Down', () => step_slice_alignment(1))

  register('pref::Toggle_View_3d', () => {
    view_3d.value = !view_3d.value
  })

  register_preference('pref::Toggle_Stroke', stroke)
  register_preference('pref::Toggle_Background', background)
  register_preference('pref::Toggle_Animate', animate)
  register_preference('pref::Toggle_Morph', morph)
  register_preference('pref::Toggle_Info', info)
  register_preference('pref::Toggle_Storytelling', storytelling)
  register_preference('pref::Toggle_Grid', grid)
  register_preference('pref::Toggle_Menu', menu)
  register_preference('pref::Toggle_Footer', footer_visible)
  register_preference('pref::Toggle_Bold', bold)
  register_preference('pref::Toggle_Medium', medium)
  register_preference('pref::Toggle_Regular', regular)
  register_preference('pref::Toggle_Light', light)
  register_preference('pref::Toggle_Boulders', boulders)
  register_preference('pref::Toggle_Rocks', rocks)
  register_preference('pref::Toggle_Gravel', gravel)
  register_preference('pref::Toggle_Sand', sand)
  register_preference('pref::Toggle_Sediment', sediment)

  register('ui::Show_Documentation', () => documentation.value?.show())
  register('ui::Open_Settings', () => preferences.value?.show())
  register('ui::Open_Account', () => router.push('/account'))
  register('ui::Clear_Sync_Time', () => localStorage.removeItem('sync_time'))
  register('ui::Toggle_Presentation', () =>
    !document.fullscreenElement
      ? document.documentElement.requestFullscreen()
      : document.exitFullscreen()
  )

  register('nav::Go_Home', () => router.push('/'))
  register('nav::Go_Statements', () => router.push('/'))
  register('nav::Go_Thoughts', () => router.push('/'))
  register('nav::Go_Account', () => router.push('/account'))
  register('nav::Go_Docs', () => router.push('/docs'))
  register('nav::Go_About', () => router.push('/about'))
  register('nav::Go_Pricing', () => router.push('/pricing'))
}
