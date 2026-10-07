/**
 * <template src="/partials/x.html"> replaces itself with the fetched partial.
 * Includes inside a partial load too.
 */
export const include = async (root) => {
  for (const template of root.querySelectorAll('template[src]')) {
    const html = await fetch(template.getAttribute('src')).then(response => response.text())
    const fragment = document.createRange().createContextualFragment(html)
    await include(fragment)
    template.replaceWith(fragment)
  }
}
