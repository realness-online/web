import { onBeforeUnmount, toValue } from 'vue'

const REVEAL_RATIO = 0.33
const REVEAL_INSET = 0.1
const ROOT_MARGIN_PERCENT = 100

/** @type {Record<string, (el: Element) => Element | null>} */
const itemprop_triggers = {
  gallery: el => el.querySelector(':scope > header'),
  features: el => el.querySelector(':scope > ol > li:first-child')
}

/** @param {Element} section */
const reveal_trigger = section => {
  if (section.localName === 'article')
    return section.querySelector(':scope > section') ?? section
  const by_itemprop = itemprop_triggers[section.getAttribute('itemprop') ?? '']
  if (by_itemprop) return by_itemprop(section) ?? section
  return section
}

/** @param {HTMLElement | null | undefined} root */
const revealable_sections = root =>
  Array.from(root?.children ?? []).filter(
    el => el.hasAttribute('itemprop') || el.localName === 'footer'
  )

/** Same threshold as IntersectionObserver - catches sections already on screen at connect. */
/** @param {Element} el */
const trigger_in_view = el => {
  const rect = el.getBoundingClientRect()
  if (rect.height <= 0) return false
  const root_bottom = window.innerHeight * (1 - REVEAL_INSET)
  const visible_top = Math.max(rect.top, 0)
  const visible_bottom = Math.min(rect.bottom, root_bottom)
  const visible = Math.max(0, visible_bottom - visible_top)
  return visible / rect.height >= REVEAL_RATIO
}

/**
 * Scroll-reveal for About page sections via [data-motion] pre-hide and [data-revealed] enter.
 *
 * @param {import('vue').MaybeRefOrGetter<HTMLElement | null | undefined>} root_ref
 */
export const use_about_section_reveal = root_ref => {
  /** @type {IntersectionObserver | null} */
  let section_observer = null

  /** @param {Element} section */
  const reveal_section = section => {
    if (section.hasAttribute('data-revealed')) return
    section.setAttribute('data-revealed', '')
    section_observer?.unobserve(reveal_trigger(section))
  }

  const connect = () => {
    const root = toValue(root_ref)
    const sections = revealable_sections(root)
    const watched = sections.map(section => ({
      section,
      trigger: reveal_trigger(section)
    }))
    const section_by_trigger = new WeakMap(
      watched.map(({ section, trigger }) => [trigger, section])
    )

    watched.forEach(({ section, trigger }) => {
      if (section.hasAttribute('data-revealed')) return
      if (trigger_in_view(trigger)) reveal_section(section)
    })

    if (typeof IntersectionObserver === 'undefined') {
      sections.forEach(reveal_section)
      return
    }

    section_observer?.disconnect()
    section_observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return
          const section = section_by_trigger.get(entry.target)
          if (section) reveal_section(section)
        })
      },
      {
        threshold: REVEAL_RATIO,
        rootMargin: `0px 0px -${REVEAL_INSET * ROOT_MARGIN_PERCENT}% 0px`
      }
    )

    watched.forEach(({ section, trigger }) => {
      if (!section.hasAttribute('data-revealed'))
        section_observer?.observe(trigger)
    })
  }

  const arm = () => {
    const root = toValue(root_ref)
    root?.setAttribute('data-motion', '')
    // Pre-hide must paint before [data-revealed] or enter animations are skipped.
    requestAnimationFrame(() => {
      requestAnimationFrame(connect)
    })
  }

  const disarm = () => {
    section_observer?.disconnect()
    section_observer = null
  }

  onBeforeUnmount(disarm)

  return { arm, disarm }
}
