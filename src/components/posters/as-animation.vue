<script setup>
  /** @typedef {import('@/types').Id} Id */
  /** @typedef {{ document_visible: import('vue').Ref<boolean>; window_focused: import('vue').Ref<boolean>; add_listeners: () => void }} PostersViewportState */
  /** @typedef {Window & { posters_viewport?: PostersViewportState }} WindowWithPostersViewport */
  import {
    computed,
    ref,
    watch,
    watchEffect as watch_effect,
    inject,
    nextTick,
    onMounted as mounted,
    onUnmounted as unmounted
  } from 'vue'
  import { as_fragment_id, as_layer_id } from '@/utils/itemid'
  import { is_vector_id, is_svg_valid } from '@/use/poster'
  import {
    stroke,
    animation_speed,
    animate as animate_pref,
    morph as morph_pref
  } from '@/utils/preference'
  import { as_key_times, breathing_order } from '@/utils/path-morph'
  import {
    morph_paths,
    as_layer_paths,
    shadow_layers
  } from '@/use/poster-morph'
  import {
    SYNC_DURATIONS,
    ANIMATION_SPEED_MULTIPLIERS
  } from '@/utils/animation-config'
  import { poster_video_export_active } from '@/use/poster-video-export'
  import { sample_smil, resting_value } from '@/utils/animation-sample'

  const SVG_NS = 'http://www.w3.org/2000/svg'

  const props = defineProps({
    id: {
      type: String,
      required: true,
      /** @type {(id: string) => id is Id} */
      validator: is_vector_id
    },
    /** SVGSVGElement from parent. Required for animation control. */
    svg: {
      type: Object,
      required: true,
      validator: is_svg_valid
    },
    /** When true, SVG SMIL is paused (poster off-screen or shown as an avatar) */
    paused: {
      type: Boolean,
      default: true
    },
    /** The poster's four density layers. Morph needs their geometry. */
    vector: {
      type: Object,
      required: false,
      default: null
    },
    /**
     * Morph only mounts for the poster the reader is actually looking at - a
     * layer's keyframes carry whole path strings, so a grid of them would put
     * megabytes of geometry in the DOM.
     */
    in_view: {
      type: Boolean,
      default: false
    }
  })

  const shadow_id = computed(() =>
    as_layer_id(/** @type {Id} */ (props.id), 'shadows')
  )

  /** @param {string} add - Targets gradients, patterns (poster id) */
  const fragment_pattern = add =>
    `${as_fragment_id(/** @type {Id} */ (props.id))}-${add}`

  /** @param {string} add - Targets path elements in shadow symbol (fill and stroke) */
  const fragment = add => `${as_fragment_id(shadow_id.value)}-${add}`

  const sync_duration = base_duration => {
    const nearest = SYNC_DURATIONS.reduce((prev, curr) =>
      Math.abs(curr - base_duration) < Math.abs(prev - base_duration)
        ? curr
        : prev
    )
    return nearest
  }

  /**
   * @param {number} base_duration - Base duration in seconds
   * @returns {number} Real seconds, sync-friendly duration times speed multiplier
   */
  const duration_seconds = base_duration => {
    const multiplier = ANIMATION_SPEED_MULTIPLIERS[animation_speed.value] || 1
    return sync_duration(base_duration) * multiplier
  }

  /**
   * Calculates duration based on animation speed preference.
   * Uses sync-friendly durations (divisors of 180) so all animations
   * return to start together for smooth looping.
   * @param {number} base_duration - Base duration in seconds
   * @returns {string} Duration string with speed multiplier applied
   */
  const duration = base_duration => `${duration_seconds(base_duration)}s`

  /**
   * A sync duration each, thinnest layer quickest, so the densities breathe
   * out of step but still meet back at the start of the base cycle. These are
   * the pace for one there-and-back hop to a neighbor - `morph_base_duration`
   * scales them up for a layer whose sweep visits more than that.
   */
  const MORPH_DURATIONS = SYNC_DURATIONS.slice(0, shadow_layers.length)
  /** Transitions in the original there-and-back hop `MORPH_DURATIONS` was paced for */
  const BASELINE_TRANSITIONS = 2

  /**
   * `breathing_order` can return a sweep through every layer rather than a
   * single hop - scale the base duration by how many transitions the sweep
   * actually carries, so the pace of any one crossing stays the one
   * `MORPH_DURATIONS` sets regardless of how many crossings the sweep makes.
   * @param {number} index
   * @param {number} transitions
   * @returns {number}
   */
  const morph_base_duration = (index, transitions) =>
    (MORPH_DURATIONS[index] * transitions) / BASELINE_TRANSITIONS
  /**
   * Leaving rest reads as a sudden jump if it eases out symmetrically - the
   * eye catches motion appearing where there was none a moment ago no matter
   * how gently it starts. Building slowly and leaving fast (easeInCubic),
   * then arriving slow (easeOutCubic), keeps the departure gradual and the
   * landing soft without a dead stop at the far shape in between.
   */
  const MORPH_LEAVE_SPLINE = '0.55 0.055 0.675 0.19'
  const MORPH_RETURN_SPLINE = '0.215 0.61 0.355 1'

  /**
   * Base-seconds each layer rests on its own shape at the end of a cycle. The
   * same absolute rest for every layer, so when the cycles meet at the base
   * boundary the whole poster reads as itself for a beat before breathing on.
   */
  const MORPH_HOLD = 6

  const MS_PER_SECOND = 1000

  /**
   * Longest any wind-down will wait for a cycle boundary. A slow layer's full
   * cycle runs to 45s, a slow gradient's to several minutes - far past what
   * turning a preference off should cost. Past this cap the animation ends
   * where it currently is and is walked home over the cap instead.
   */
  const WIND_DOWN_CAP = 5

  /** @type {import('vue').Ref<string[] | null>} */
  const morph_layers = ref(null)

  watch(
    () => [morph_pref.value, props.in_view, props.vector],
    async ([wanted, in_view, vector]) => {
      if (!wanted || !in_view || !vector) return
      if (morph_layers.value) return
      morph_layers.value = await morph_paths(props.id, vector)
    },
    { immediate: true }
  )

  /**
   * Lags `morph_pref` on both ends - a start delay before the layers first
   * move, and on the way off the layers finish their cycle back to their own
   * shapes before the elements leave the DOM.
   */
  const morph_active = ref(false)

  /**
   * SMIL cannot point at another element's `d`, so every keyframe carries a
   * whole path string. That is why this only builds for the in-view poster.
   */
  const morph_animations = computed(() => {
    if (!morph_active.value || !props.in_view) return []
    const layers = morph_layers.value
    if (!layers) return []

    return shadow_layers
      .map((name, index) => {
        const order = breathing_order(index, shadow_layers.length)
        const frames = order.map(slot => layers[slot])
        if (frames.some(frame => !frame)) return null

        const base_duration = morph_base_duration(index, order.length - 1)

        // Rest on the layer's own shape at the end of each cycle
        frames.push(frames[0])
        return {
          name,
          href: fragment(name),
          values: frames.join(';'),
          key_times: as_key_times(frames.length, MORPH_HOLD / base_duration),
          key_splines: frames
            .slice(1)
            .map((unused, transition) =>
              transition === 0 ? MORPH_LEAVE_SPLINE : MORPH_RETURN_SPLINE
            )
            .join(';'),
          dur: duration(base_duration)
        }
      })
      .filter(Boolean)
  })

  const static_stroke_opacity = '0.90'
  const static_fill_opacity = '0.90'
  const static_stroke_width = '0.33'

  const MAX_STEP_SIZE = 40
  const MAX_MOMENTUM_MULTIPLIER = 5
  const STEP_SIZE_SHIFT = 10
  const STEP_SIZE_DEFAULT = 0.5
  const MOMENTUM_FACTOR = 0.5

  let last_key_time = 0
  let key_press_count = 0
  let last_key = null
  let last_had_shift = false
  let is_processing = false
  const momentum_reset_delay = 500
  const throttle_delay = 64

  const w = /** @type {WindowWithPostersViewport | null} */ (
    typeof window !== 'undefined' ? window : null
  )
  const viewport_state =
    w &&
    (w.posters_viewport ??= (() => {
      const doc = typeof document !== 'undefined'
      const document_visible = ref(
        doc ? document.visibilityState === 'visible' : true
      )
      const window_focused = ref(true)
      let listeners_added = false

      const update = (doc_visible, win_focused) => {
        document_visible.value = doc_visible
        window_focused.value = win_focused
      }
      const add_listeners = () => {
        if (listeners_added) return
        listeners_added = true
        document.addEventListener('visibilitychange', () => {
          update(document.visibilityState === 'visible', window_focused.value)
        })
        const on_focus = () =>
          update(document.visibilityState === 'visible', true)
        const on_blur = () =>
          update(document.visibilityState === 'visible', false)
        window.addEventListener('focus', on_focus)
        window.addEventListener('blur', on_blur)
        document.addEventListener('focus', on_focus)
        document.addEventListener('blur', on_blur)
        update(doc ? document.visibilityState === 'visible' : true, true)
      }
      return { document_visible, window_focused, add_listeners }
    })())

  const shared_document_visible = viewport_state?.document_visible ?? ref(true)
  const shared_window_focused = viewport_state?.window_focused ?? ref(true)
  viewport_state?.add_listeners?.()

  const viewport_visible = computed(
    () => shared_document_visible.value && shared_window_focused.value
  )

  /** WebKit resumes SMIL when the tab or window regains attention, after our sync pause. Re-pause on a short deferral. */
  const pause_smil_basic = () => {
    props.svg.pauseAnimations()
    requestAnimationFrame(() => props.svg.pauseAnimations())
  }

  const pause_smil_after_webkit_resume = () => {
    pause_smil_basic()
    queueMicrotask(() => props.svg.pauseAnimations())
    requestAnimationFrame(() => {
      props.svg.pauseAnimations()
      requestAnimationFrame(() => props.svg.pauseAnimations())
    })
  }

  watch(viewport_visible, (visible, was_visible) => {
    if (!visible || was_visible !== false) return
    if (animate_pref.value === true) return
    pause_smil_after_webkit_resume()
  })

  const key_commands = inject('key-commands', null)

  /**
   * @param {KeyboardEvent} event
   */
  const handle_keydown = event => {
    const is_arrow = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
    if (!is_arrow) return
    if (key_commands?.check_input_focus?.()) return
    if (event.ctrlKey || event.altKey || event.metaKey) return

    event.preventDefault()

    if (is_processing) return
    is_processing = true
    setTimeout(() => {
      is_processing = false
    }, throttle_delay)

    const now = Date.now()
    const same_key = event.key === last_key && event.shiftKey === last_had_shift

    if (now - last_key_time > momentum_reset_delay || !same_key)
      key_press_count = 0

    key_press_count++
    last_key_time = now
    last_key = event.key
    last_had_shift = event.shiftKey

    // Base step increases with momentum
    const base_step = event.shiftKey ? STEP_SIZE_SHIFT : STEP_SIZE_DEFAULT
    const momentum_multiplier = Math.min(
      key_press_count * MOMENTUM_FACTOR,
      MAX_MOMENTUM_MULTIPLIER
    )
    const step = Math.min(base_step * (1 + momentum_multiplier), MAX_STEP_SIZE)

    const current_time = props.svg.getCurrentTime()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const new_time = Math.max(0, current_time + step * direction)

    props.svg.setCurrentTime(new_time)
  }

  /** @type {import('vue').Ref<SVGElement | null>} */
  const timeline = ref(null)
  /** @type {import('vue').Ref<SVGElement | null>} */
  const morph_group = ref(null)
  /** A preference just turned off; cycles are still landing on their base values */
  const winding_down = ref(false)
  /**
   * Ended SMIL animations cannot restart in sync, so after a wind-down the
   * elements are rebuilt - fresh ones re-enter the shared timeline in phase.
   */
  const generation = ref(0)
  let elements_ended = false
  /** Spliced single-shot legs walking capped animations home (see `settle_leaf`) */
  let settle_legs = []
  let wind_down_timer = null
  let morph_wind_down_timer = null
  /**
   * `props.svg.getCurrentTime()` when the current morph leaves last began.
   * They start on `begin="indefinite"` + `beginElement()` rather than
   * `begin="0s"` so turning morph on always opens on the resting shape
   * already drawn statically, instead of snapping to wherever a
   * document-synced cycle happens to be after the poster has been
   * animating for a while.
   */
  let morph_epoch = 0

  watch(morph_group, group => {
    if (!group) return
    nextTick(() => {
      const leaves = group.querySelectorAll('animate')
      if (!leaves.length) return
      morph_epoch =
        typeof props.svg.getCurrentTime === 'function'
          ? props.svg.getCurrentTime()
          : 0
      leaves.forEach(leaf => {
        if (typeof leaf.beginElement === 'function') leaf.beginElement()
      })
    })
  })

  /** The reader can see the poster and nothing else needs SMIL stopped */
  const watchable = computed(
    () =>
      !props.paused &&
      viewport_visible.value &&
      poster_video_export_active.value === 0
  )
  // In-app `animate` only (default off). Parent also gates; we re-check so SMIL cannot run if pref is off.
  const smil_running = computed(
    () => animate_pref.value === true && watchable.value
  )

  /**
   * Morph's geometry is ready, the reader is actually looking at it, and SMIL
   * is actually going to run - no reason to carry the normalized geometry, let
   * alone breathe it, while `animate` itself is off and nothing is moving.
   */
  const morph_wanted = computed(
    () =>
      morph_pref.value &&
      props.in_view &&
      smil_running.value &&
      Boolean(morph_layers.value)
  )

  /**
   * A leaf whose boundary is further off than the cap: end it now and hand
   * the rest of the way home to a short single-shot leg from where it
   * currently sits back to its resting value. Morph settles with a CSS
   * transition because `d` is a CSS property; these leaves animate gradient
   * coordinates too, which CSS cannot touch, so the leg is a spliced SMIL
   * animation instead. It is removed when it lands, and removal reveals the
   * element's own base value - the same resting value it just arrived on.
   * @param {SVGAnimateElement} leaf
   * @param {number} elapsed Seconds into the leaf's current cycle
   */
  const settle_leaf = (leaf, elapsed) => {
    if (typeof document === 'undefined') return leaf.endElementAt(0)
    const from = sample_smil(leaf, elapsed)
    const home = resting_value(leaf)
    if (!from || !home || !leaf.parentNode) return leaf.endElementAt(0)

    const leg = document.createElementNS(SVG_NS, 'animate')
    leg.setAttribute('itemprop', 'settle')
    leg.setAttribute('href', leaf.getAttribute('href'))
    leg.setAttribute('attributeName', leaf.getAttribute('attributeName'))
    leg.setAttribute('dur', `${WIND_DOWN_CAP}s`)
    leg.setAttribute('begin', 'indefinite')
    leg.setAttribute('values', `${from};${home}`)
    leg.setAttribute('calcMode', 'spline')
    leg.setAttribute('keyTimes', '0;1')
    leg.setAttribute('keySplines', MORPH_RETURN_SPLINE)
    leaf.parentNode.appendChild(leg)
    settle_legs.push(leg)
    // Begun before the running leaf ends, both in this one tick, so no frame
    // renders with the attribute back at its base value
    if (typeof leg.beginElement === 'function') leg.beginElement()
    leaf.endElementAt(0)
  }

  /**
   * Once the legs have landed the base value underneath is what they arrived
   * on, so taking them out is invisible - and it keeps a stale leg from
   * fighting the fresh timeline when animation comes back on.
   */
  const clear_settle_legs = () => {
    settle_legs.forEach(leg => leg.remove())
    settle_legs = []
  }

  /**
   * Every animation begins and ends its cycle on its resting value, so ending
   * it exactly on the next cycle boundary removes it without a visible jump -
   * as long as that boundary is close enough to wait for.
   * @param {ParentNode | null} root
   * @returns {number} Seconds until the last animation lands
   */
  const end_at_cycle_boundaries = root => {
    if (!root || typeof props.svg.getCurrentTime !== 'function') return 0
    const now = props.svg.getCurrentTime()
    let longest = 0
    root.querySelectorAll('animate[dur]').forEach(leaf => {
      // Morph's leaves don't begin at document time zero (see morph_epoch
      // below), so this document-synced modulo doesn't locate them correctly
      // - wind_down_morph handles their own ending instead.
      if (morph_group.value?.contains(leaf)) return
      if (typeof leaf.endElementAt !== 'function') return
      const dur = parseFloat(leaf.getAttribute('dur'))
      if (!dur) return
      const remaining = dur - (now % dur)
      if (remaining > WIND_DOWN_CAP) {
        settle_leaf(leaf, now % dur)
        longest = Math.max(longest, WIND_DOWN_CAP)
        return
      }
      leaf.endElementAt(remaining)
      if (remaining > longest) longest = remaining
    })
    if (longest) elements_ended = true
    return longest
  }

  /**
   * Morph's own wind-down: a layer close enough to its cycle boundary lands
   * there as usual, but a layer that is not gets switched to a short,
   * single-shot leg back to its own shape instead of either freezing
   * mid-breath or running well past the cap.
   * @returns {number} Seconds until every layer has settled
   */
  /** @param {string} spline Four numbers, space separated, as SMIL keySplines write them */
  const as_css_bezier = spline =>
    `cubic-bezier(${spline.trim().split(/\s+/).join(',')})`

  /**
   * A layer whose cycle boundary is too far away to wait for. SMIL cannot be
   * told to run its existing indefinite cycle faster, so instead: end it now,
   * pre-set the base to roughly where it was (its breathing partner, the
   * nearer of the two shapes it was moving between), then glide the base the
   * rest of the way home with a plain CSS transition - simpler and more
   * reliable than splicing a fresh SMIL animation into a running timeline.
   * @param {string} name
   * @param {string} from_shape
   * @param {string} to_shape
   * @param {SVGAnimateElement | null} leaf
   */
  const settle_layer = (name, from_shape, to_shape, leaf) => {
    const target = document.getElementById(fragment(name).slice(1))
    if (!target) return
    target.style.transition = 'none'
    target.setAttribute('d', from_shape)
    if (leaf && typeof leaf.endElementAt === 'function') leaf.endElementAt(0)
    // Forces layout so the browser locks in `from_shape` as the transition's
    // starting point, rather than coalescing it with the change below
    target.getBoundingClientRect()
    target.style.transition = `d ${WIND_DOWN_CAP}s ${as_css_bezier(MORPH_RETURN_SPLINE)}`
    target.setAttribute('d', to_shape)
  }

  /** A stray transition from an interrupted settle should not affect the next prime or SMIL take-over */
  const clear_settle_transitions = () => {
    if (typeof document === 'undefined') return
    shadow_layers.forEach(name => {
      const target = document.getElementById(fragment(name).slice(1))
      if (target) target.style.transition = ''
    })
  }

  /**
   * Morph's own wind-down: a layer close enough to its cycle boundary lands
   * there as usual; one that is not gets ended now and settled the rest of
   * the way home with a CSS transition, so nothing runs well past the cap or
   * sits frozen mid-breath waiting for it.
   * @returns {number} Seconds until every layer has settled
   */
  const wind_down_morph = () => {
    if (!morph_group.value || typeof props.svg.getCurrentTime !== 'function')
      return 0
    const layers = morph_layers.value
    // Relative to when this generation's leaves actually began (see
    // morph_epoch), not document time zero like the persistent animations.
    const elapsed = Math.max(0, props.svg.getCurrentTime() - morph_epoch)
    let longest = 0
    shadow_layers.forEach((name, index) => {
      const order = breathing_order(index, shadow_layers.length)
      const dur = duration_seconds(morph_base_duration(index, order.length - 1))
      if (!dur) return
      const remaining = dur - (elapsed % dur)
      const leaf = morph_group.value.querySelector(`[href="${fragment(name)}"]`)
      if (remaining > WIND_DOWN_CAP) {
        const own = layers?.[index]
        const partner = layers?.[order[1]]
        if (own && partner) settle_layer(name, partner, own, leaf)
        longest = Math.max(longest, WIND_DOWN_CAP)
        return
      }
      if (leaf && typeof leaf.endElementAt === 'function')
        leaf.endElementAt(remaining)
      longest = Math.max(longest, remaining)
    })
    if (longest) elements_ended = true
    return longest
  }

  const cancel_wind_down = () => {
    if (wind_down_timer) clearTimeout(wind_down_timer)
    wind_down_timer = null
    clear_settle_legs()
    winding_down.value = false
  }

  watch(animate_pref, (on, was_on) => {
    if (on || !was_on || !watchable.value) return
    const longest = end_at_cycle_boundaries(timeline.value)
    if (!longest) return
    winding_down.value = true
    wind_down_timer = setTimeout(
      () => cancel_wind_down(),
      longest * MS_PER_SECOND
    )
  })

  watch(
    morph_wanted,
    wanted => {
      if (morph_wind_down_timer) clearTimeout(morph_wind_down_timer)
      morph_wind_down_timer = null

      if (wanted) {
        clear_settle_transitions()
        if (!morph_active.value) morph_active.value = true
        else if (elements_ended) {
          // Already running but its elements ended (e.g. `animate` wound
          // down the whole timeline) - ended SMIL cannot restart, rebuild.
          elements_ended = false
          generation.value += 1
        }
        return
      }

      if (!morph_active.value) return
      // Still watchable even though it stopped being wanted (`animate` or
      // `morph` just turned off) - keep going long enough to settle gracefully
      const longest = watchable.value ? wind_down_morph() : 0
      if (!longest) {
        morph_active.value = false
        return
      }
      morph_wind_down_timer = setTimeout(() => {
        morph_wind_down_timer = null
        morph_active.value = false
      }, longest * MS_PER_SECOND)
    },
    { immediate: true }
  )

  /**
   * The normalized geometry is several times heavier than the layer's true
   * artwork - fine while morph is actually using it, wasted once the reader
   * has it turned off. Keep it on the shadow through a wind-down, same as
   * `morph_active`, so removing the `<animate>` still doesn't pop; only fall
   * back to the original once morph has genuinely finished with it.
   */
  const shadow_shapes = computed(() =>
    morph_wanted.value || morph_active.value ? morph_layers.value : null
  )

  watch(
    shadow_shapes,
    shapes => {
      if (typeof document === 'undefined') return
      const originals = as_layer_paths(props.vector)
      shadow_layers.forEach((name, index) => {
        const value = shapes?.[index] || originals[index]
        if (!value) return
        // getElementById, not a CSS selector - poster ids can start with a
        // digit, which querySelector rejects as an invalid identifier
        document
          .getElementById(fragment(name).slice(1))
          ?.setAttribute('d', value)
      })
    },
    { immediate: true }
  )

  watch_effect(() => {
    if (smil_running.value) {
      if (elements_ended) {
        elements_ended = false
        generation.value += 1
      }
      cancel_wind_down()
      props.svg.unpauseAnimations()
    } else if (winding_down.value && watchable.value)
      // Keep the timeline running so every cycle lands back on its base value
      props.svg.unpauseAnimations()
    else {
      cancel_wind_down()
      pause_smil_basic()
    }
  })

  // No gyro binding here on purpose: `bind_device_orientation` asks for motion
  // permission from whatever surface it binds to, so binding a poster's own svg
  // put the iOS prompt in front of every feed tap. Only 3D asks now.

  /** bfcache restore can skip a false-to-true viewport transition; still re-pause SMIL if pref is off. */
  const handle_pageshow = () => {
    if (animate_pref.value === true) return
    pause_smil_after_webkit_resume()
  }

  mounted(() => {
    viewport_state?.add_listeners?.()
    window.addEventListener('keydown', handle_keydown)
    window.addEventListener('pageshow', handle_pageshow)
  })

  unmounted(() => {
    window.removeEventListener('keydown', handle_keydown)
    window.removeEventListener('pageshow', handle_pageshow)
    if (wind_down_timer) clearTimeout(wind_down_timer)
    if (morph_wind_down_timer) clearTimeout(morph_wind_down_timer)
  })

  // The true morph gate (wind-down included) so as-svg can style cutouts to
  // match actually-running morph rather than re-deriving the preference.
  defineExpose({ morph_active })
</script>

<template>
  <animate ref="timeline" itemprop="timeline" :key="generation">
    <animate v-if="morph_animations.length" ref="morph_group" itemprop="morph">
      <animate
        v-for="layer in morph_animations"
        :key="layer.name"
        :href="layer.href"
        attributeName="d"
        repeatCount="indefinite"
        :dur="layer.dur"
        begin="indefinite"
        :values="layer.values"
        :keyTimes="layer.key_times"
        calcMode="spline"
        :keySplines="layer.key_splines" />
    </animate>

    <animate v-if="stroke">
      <animate
        :href="fragment('light')"
        attributeName="stroke-opacity"
        repeatCount="indefinite"
        :dur="duration(18)"
        begin="0s"
        :values="`${static_stroke_opacity};0.1;${static_stroke_opacity}`"
        keyTimes="0;0.5;1"
        keySplines="0.42 0 1 1; 0 0 0.58 1" />
      <animate
        :href="fragment('regular')"
        attributeName="stroke-opacity"
        repeatCount="indefinite"
        :dur="duration(30)"
        begin="0s"
        :values="`${static_stroke_opacity};0.1;${static_stroke_opacity}`"
        keyTimes="0;0.5;1"
        keySplines="0.42 0 1 1; 0 0 0.58 1" />
      <animate
        :href="fragment('medium')"
        attributeName="stroke-opacity"
        repeatCount="indefinite"
        :dur="duration(30)"
        begin="0s"
        :values="`${static_stroke_opacity};0.1;${static_stroke_opacity}`"
        keyTimes="0;0.5;1"
        keySplines="0.42 0 1 1; 0 0 0.58 1" />
      <animate
        :href="fragment('bold')"
        attributeName="stroke-opacity"
        repeatCount="indefinite"
        :dur="duration(18)"
        begin="0s"
        :values="`${static_stroke_opacity};0.1;${static_stroke_opacity}`"
        keyTimes="0;0.5;1"
        keySplines="0.42 0 1 1; 0 0 0.58 1" />

      <animate
        :href="fragment('light')"
        attributeName="stroke-width"
        repeatCount="indefinite"
        :dur="duration(18)"
        begin="0s"
        :values="`${static_stroke_width};0.1;0.45;${static_stroke_width}`"
        keyTimes="0;0.33;0.66;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment('regular')"
        attributeName="stroke-width"
        repeatCount="indefinite"
        :dur="duration(30)"
        begin="0s"
        :values="`${static_stroke_width};0.66;0.1;${static_stroke_width}`"
        keyTimes="0;0.33;0.66;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment('medium')"
        attributeName="stroke-width"
        repeatCount="indefinite"
        :dur="duration(30)"
        begin="0s"
        :values="`${static_stroke_width};0.1;0.77;0.1;${static_stroke_width}`"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment('bold')"
        attributeName="stroke-width"
        repeatCount="indefinite"
        :dur="duration(18)"
        begin="0s"
        :values="`${static_stroke_width};0.1;0.66;0.1;${static_stroke_width}`"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />

      <animate
        :href="fragment('light')"
        attributeName="stroke-dashoffset"
        repeatCount="indefinite"
        :dur="duration(18)"
        begin="0s"
        values="0;-24;0"
        keyTimes="0;0.5;1"
        keySplines="0.42 0 1 1; 0 0 0.58 1" />
      <animate
        :href="fragment('regular')"
        attributeName="stroke-dashoffset"
        repeatCount="indefinite"
        :dur="duration(30)"
        begin="0s"
        values="0;-34;0"
        keyTimes="0;0.5;1"
        keySplines="0.42 0 1 1; 0 0 0.58 1" />
      <animate
        :href="fragment('medium')"
        attributeName="stroke-dashoffset"
        repeatCount="indefinite"
        :dur="duration(30)"
        begin="0s"
        values="0;-44;0"
        keyTimes="0;0.5;1"
        keySplines="0.42 0 1 1; 0 0 0.58 1" />
      <animate
        :href="fragment('bold')"
        attributeName="stroke-dashoffset"
        repeatCount="indefinite"
        :dur="duration(60)"
        begin="0s"
        values="0;-56;0"
        keyTimes="0;0.5;1"
        keySplines="0.42 0 1 1; 0 0 0.58 1" />
    </animate>

    <animate id="default-animation">
      <animate
        :href="fragment('light')"
        attributeName="fill-opacity"
        repeatCount="indefinite"
        :dur="duration(18)"
        begin="0s"
        :values="`${static_fill_opacity};0.75;${static_fill_opacity};0.21;${static_fill_opacity}`"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment('medium')"
        attributeName="fill-opacity"
        repeatCount="indefinite"
        :dur="duration(18)"
        begin="0s"
        :values="`${static_fill_opacity};0.6;${static_fill_opacity};0.5;${static_fill_opacity}`"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment('bold')"
        attributeName="fill-opacity"
        repeatCount="indefinite"
        :dur="duration(16)"
        begin="0s"
        :values="`${static_fill_opacity};0.75;${static_fill_opacity};0.6;0.8;${static_fill_opacity};`"
        keyTimes="0;0.2;0.4;0.6;0.8;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />

      <animate
        :href="fragment_pattern('radial-background')"
        attributeName="cx"
        repeatCount="indefinite"
        :dur="duration(68)"
        begin="0s"
        values="0%;150%;-50%;200%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment_pattern('radial-background')"
        attributeName="cy"
        repeatCount="indefinite"
        :dur="duration(110)"
        begin="0s"
        values="0%;200%;-25%;150%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment_pattern('vertical-light')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(110)"
        begin="0s"
        values="0%;-50%;150%;200%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment_pattern('vertical-light')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(180)"
        begin="0s"
        values="0%;250%;-75%;175%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment_pattern('horizontal-regular')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(68)"
        begin="0s"
        values="0%;200%;-100%;300%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment_pattern('horizontal-regular')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(110)"
        begin="0s"
        values="0%;-50%;200%;150%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment_pattern('vertical-medium')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(68)"
        begin="0s"
        values="0%;175%;-75%;225%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment_pattern('vertical-medium')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(110)"
        begin="0s"
        values="0%;300%;-100%;200%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment_pattern('vertical-bold')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(68)"
        begin="0s"
        values="0%;-100%;200%;300%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment_pattern('vertical-bold')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(110)"
        begin="0s"
        values="0%;250%;-150%;175%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />

      <animate
        :href="fragment_pattern('radial')"
        attributeName="cx"
        repeatCount="indefinite"
        :dur="duration(84)"
        begin="0s"
        values="0%;200%;-100%;250%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment_pattern('radial')"
        attributeName="cy"
        repeatCount="indefinite"
        :dur="duration(134)"
        begin="0s"
        values="0%;-75%;300%;150%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />

      <animate
        :href="fragment_pattern('vertical-background')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(76)"
        begin="0s"
        values="0%;300%;-150%;200%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment_pattern('vertical-background')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(122)"
        begin="0s"
        values="0%;175%;-100%;250%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />

      <animate
        :href="fragment_pattern('horizontal-light')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(94)"
        begin="0s"
        values="0%;-100%;250%;300%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment_pattern('horizontal-light')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(146)"
        begin="0s"
        values="0%;300%;-200%;175%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />

      <animate
        :href="fragment_pattern('horizontal-medium')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(58)"
        begin="0s"
        values="0%;225%;-125%;275%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment_pattern('horizontal-medium')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(102)"
        begin="0s"
        values="0%;-150%;250%;200%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />

      <animate
        :href="fragment_pattern('horizontal-bold')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(72)"
        begin="0s"
        values="0%;350%;-200%;300%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />
      <animate
        :href="fragment_pattern('horizontal-bold')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(116)"
        begin="0s"
        values="0%;275%;-175%;225%;0%"
        keyTimes="0;0.25;0.5;0.75;1"
        keySplines="0.42 0 1 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 0.58 1" />

      <animate
        href="#lightbar-back"
        attributeName="fill-opacity"
        repeatCount="indefinite"
        :dur="duration(18)"
        begin="0s"
        values="1;0.66;1"
        keyTimes="0;0.33;1"
        keySplines="0.42 0 1 1; 0 0 0.58 1" />
      <animate
        href="#lightbar-front"
        attributeName="fill-opacity"
        repeatCount="indefinite"
        :dur="duration(30)"
        begin="0s"
        values="1;0.66;1"
        keyTimes="0;0.66;1"
        keySplines="0.42 0 1 1; 0 0 0.58 1" />
    </animate>
  </animate>
</template>

<style>
  g[itemprop='animation'] {
    & animate {
      animation-play-state: paused;
    }
  }

  svg[data-animate] {
    & g[itemprop='animation'] animate {
      animation-play-state: running;
    }
    & path[itemprop='cutout'] {
      filter: brightness(1) saturate(1);
      animation-play-state: paused;
      transition: fill-opacity ease-in-out 0.8s;
      &:focus {
        outline: none;
      }
      &:hover {
        will-change: fill-opacity;
        animation: fade-back ease-out 0.4s 1s forwards;
        animation-iteration-count: 1;
        animation-delay: 1s;
        fill-opacity: 0.75;
      }
      &:active {
        filter: brightness(1.1) saturate(1.1);
        opacity: 0.9;
      }
    }
  }

  @keyframes fade-back {
    to {
      fill-opacity: 0.5;
    }
  }
</style>
