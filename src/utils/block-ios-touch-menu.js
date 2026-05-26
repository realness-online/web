/**
 * Block iOS magnifier, Look Up, and Translate on interaction surfaces.
 * @param {Event} event
 */
export const prevent_ios_touch_menu = event => {
  event.preventDefault()
}

/**
 * touchstart preventDefault must be non-passive to suppress iOS callout menus.
 * @param {HTMLCanvasElement} canvas
 * @returns {() => void}
 */
export const bind_ios_touch_menu_block = canvas => {
  canvas.addEventListener('touchstart', prevent_ios_touch_menu, {
    passive: false
  })

  return () => {
    canvas.removeEventListener('touchstart', prevent_ios_touch_menu)
  }
}
