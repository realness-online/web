import { Container, fuzzyFilter, Input, matchesKey, SelectList, Spacer, Text } from '@earendil-works/pi-tui'

/** @typedef {import('./changes.js').FileEntry} FileEntry */
/** @typedef {import('@earendil-works/pi-tui').SelectItem} SelectItem */

/** @param {any} theme */
const list_theme = theme => ({
  selectedPrefix: (/** @type {string} */ text) => theme.fg('accent', text),
  selectedText: (/** @type {string} */ text) => theme.fg('accent', text),
  description: (/** @type {string} */ text) => theme.fg('muted', text),
  scrollInfo: (/** @type {string} */ text) => theme.fg('dim', text),
  noMatch: (/** @type {string} */ text) => theme.fg('warning', text)
})

/**
 * Type-to-filter file picker. Ctrl+Shift+D picks and asks for the diff.
 * @param {any} ctx
 * @param {FileEntry[]} files
 * @returns {Promise<{ file: FileEntry, diff: boolean } | null>}
 */
export const pick_file = (ctx, files) =>
  ctx.ui.custom(
    (/** @type {any} */ tui, /** @type {any} */ theme, /** @type {any} */ _keys, /** @type {Function} */ done) => {
      /** @type {SelectItem[]} */
      const items = files.map(file => ({ value: file.path, label: file.label }))
      const search = new Input()
      const list_box = new Container()
      /** @type {SelectList | null} */
      let list = null
      /**
       * @param {string | undefined} path
       * @param {boolean} diff
       */
      const finish = (path, diff) => done(path ? { file: files.find(file => file.path === path), diff } : null)

      const refresh = () => {
        const query = search.getValue()
        const shown = query ? fuzzyFilter(items, query, item => item.label) : items
        list_box.clear()
        list = new SelectList(shown, Math.min(Math.max(shown.length, 1), 12), list_theme(theme))
        list.onSelect = item => finish(item.value, false)
        list.onCancel = () => finish(undefined, false)
        list_box.addChild(list)
      }

      const box = new Container()
      box.addChild(new Text(theme.fg('accent', theme.bold('Files')), 0, 0))
      box.addChild(search)
      box.addChild(new Spacer(1))
      box.addChild(list_box)
      box.addChild(new Text(theme.fg('dim', 'type to filter, enter for actions, ctrl+shift+d diff, esc cancel'), 0, 0))
      refresh()

      return {
        get focused() {
          return search.focused
        },
        set focused(value) {
          search.focused = value
        },
        render: (/** @type {number} */ width) => box.render(width),
        invalidate: () => box.invalidate(),
        handleInput: (/** @type {string} */ data) => {
          if (matchesKey(data, 'ctrl+shift+d')) return finish(list?.getSelectedItem()?.value, true)
          if (['up', 'down', 'enter', 'escape', 'pageUp', 'pageDown'].some(key => matchesKey(data, key)))
            list?.handleInput(data)
          else {
            search.handleInput(data)
            refresh()
          }
          tui.requestRender()
        }
      }
    }
  )

/**
 * @param {any} ctx
 * @param {string} title
 * @param {SelectItem[]} actions
 * @returns {Promise<string | undefined>}
 */
export const pick_action = async (ctx, title, actions) => {
  const label = await ctx.ui.select(
    title,
    actions.map(action => action.label)
  )
  return actions.find(action => action.label === label)?.value
}
