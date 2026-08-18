/**
 * Every key command that works anywhere in the app: the preference toggles,
 * the cycles, the ui actions and the navigation. Registered against the
 * 'Global' context, which use_keymap adds on mount and drops on unmount.
 */

import { watch } from 'vue'
import { useMagicKeys } from '@vueuse/core'
import { useRouter as use_router } from 'vue-router'
import { use_keymap } from '@/use/key-commands'
import { camera_next, camera_reach, CAMERA_REPEAT_MS } from '@/use/camera'
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
  color_cycle,
  only_mine,
  info,
  storytelling,
  grid,
  morph,
  aspect_ratio_mode,
  menu,
  footer_visible,
  view_3d,
  toggle_layer,
  camera_y
} from '@/utils/preference'

const ASPECT_RATIOS = [
  'auto',
  '1/1',
  '4/3',
  '1.618/1',
  '16/9',
  '2.35/1',
  '2.76/1'
]

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

  // Holding the key should pick up speed like a dolly leaving its mark, but
  // only so far - past a point it stops reading as a camera and starts
  // reading as a jump cut. Each repeat gains a little, capped, and a pause
  // (or a change of direction) puts it back at walking pace.
  let camera_ramp = 1
  let camera_last = 0
  let camera_heading = 0

  /** @param {number} direction -1 moves the camera up, 1 down */
  const move_camera = direction => {
    const now = performance.now()
    const held =
      direction === camera_heading && now - camera_last < CAMERA_REPEAT_MS
    const press = camera_next({
      at: camera_y.value,
      direction,
      ramp: camera_ramp,
      held,
      reach: camera_reach.value
    })
    camera_ramp = press.ramp
    camera_last = now
    camera_heading = direction
    camera_y.value = press.at
  }
  register('pref::Camera_Up', () => move_camera(-1))
  register('pref::Camera_Down', () => move_camera(1))
  register('pref::Camera_Center', () => {
    camera_ramp = 1
    camera_y.value = 0
  })

  register('pref::Toggle_View_3d', () => {
    view_3d.value = !view_3d.value
  })

  register_preference('pref::Toggle_Stroke', stroke)
  register_preference('pref::Toggle_Animate', animate)
  register_preference('pref::Toggle_Morph', morph)
  register_preference('pref::Toggle_Info', info)
  register_preference('pref::Toggle_Storytelling', storytelling)
  register_preference('pref::Toggle_Grid', grid)
  register_preference('pref::Toggle_Menu', menu)
  // No default key. They are in `preference_command`, so a custom binding can
  // reach them; without a handler that binding would quietly do nothing.
  register_preference('pref::Toggle_Color_Cycle', color_cycle)
  register_preference('pref::Toggle_Only_Mine', only_mine)
  register_preference('pref::Toggle_Footer', footer_visible)
  const register_layer = (command, layer, group, siblings) =>
    register(command, () => toggle_layer(layer, group, siblings))

  // Background is the ground the others sit on, not one of the alternatives.
  // Soloing a shadow layer leaves it alone; it goes off only when asked.
  const shadows = { bold, medium, regular, light }
  const geology = { boulders, rocks, gravel, sand, sediment }

  register_layer('pref::Toggle_Background', background, shadow, {})
  register_layer('pref::Toggle_Bold', bold, shadow, shadows)
  register_layer('pref::Toggle_Medium', medium, shadow, shadows)
  register_layer('pref::Toggle_Regular', regular, shadow, shadows)
  register_layer('pref::Toggle_Light', light, shadow, shadows)
  register_layer('pref::Toggle_Boulders', boulders, mosaic, geology)
  register_layer('pref::Toggle_Rocks', rocks, mosaic, geology)
  register_layer('pref::Toggle_Gravel', gravel, mosaic, geology)
  register_layer('pref::Toggle_Sand', sand, mosaic, geology)
  register_layer('pref::Toggle_Sediment', sediment, mosaic, geology)

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
