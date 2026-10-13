import { records } from './stream.js'
import { mount } from './terminal/terminal.js'

const actor = new URLSearchParams(location.search).get('actor')
const form = document.querySelector('form')
const conversation = document.querySelector('#conversation')
const status = document.querySelector('#status')
const pane = document.querySelector('#terminal-pane')
const input = form.elements.message
const RECONNECT_MS = 2000
const VIEWS = ['both', 'gui', 'tui']

const WIDE = matchMedia('(min-width: 80rem)')

const mount_tui = () => {
  if (!WIDE.matches || !pane.hidden) return
  pane.hidden = false
  mount(pane, {
    actor,
    base: `${location.origin}/`,
    wasm_url: new URL('./terminal/ghostty-vt.wasm', import.meta.url),
    focus: false
  }).catch(error => {
    status.textContent = `TUI: ${error.message}`
  })
}

if (document.documentElement.dataset.view !== 'tui') input.focus()

const show_view = view => {
  document.documentElement.dataset.view = view
  for (const button of document.querySelectorAll('nav button'))
    button.ariaPressed = String(button.value === view)
  window.dispatchEvent(new Event('resize'))
  if (view === 'tui') pane.querySelector('canvas').focus()
  else input.focus()
}
for (const button of document.querySelectorAll('nav button'))
  button.addEventListener('click', () => show_view(button.value))
window.addEventListener(
  'keydown',
  event => {
    if (!event.ctrlKey || event.key !== '`' || !WIDE.matches) return
    event.preventDefault()
    event.stopImmediatePropagation()
    const now = VIEWS.indexOf(document.documentElement.dataset.view ?? 'both')
    show_view(VIEWS[(now + 1) % VIEWS.length])
  },
  { capture: true }
)

const set_working = on => {
  form.ariaBusy = on ? 'true' : null
}

const fit_input = () => {
  input.style.height = 'auto'
  input.style.height = `${input.scrollHeight}px`
}
input.addEventListener('input', fit_input)

const show_links = (node, text) => {
  const urls = /https?:\/\/[^\s<>]+/g
  let start = 0
  for (const match of text.matchAll(urls)) {
    node.append(document.createTextNode(text.slice(start, match.index)))
    const url = match[0].replace(/[.,;!?)]*$/, '')
    const link = document.createElement('a')
    link.href = url
    link.textContent = url
    link.rel = 'noopener noreferrer'
    node.append(link)
    start = match.index + url.length
  }
  node.append(document.createTextNode(text.slice(start)))
}

const said = new WeakMap()
const show_text = (item, text) => {
  said.set(item, text)
  const statements = text.split(/\n\s*\n/).filter(part => part.trim())
  item.querySelectorAll('[itemprop="text"]').forEach(node => node.remove())
  for (const statement of statements) {
    const node = document.createElement('p')
    node.setAttribute('itemprop', 'text')
    show_links(node, statement.trim())
    item.append(node)
  }
}

const line = (speaker, text = '') => {
  const item = document.createElement('li')
  item.setAttribute('itemtype', 'https://schema.org/Message')
  item.setAttribute('itemscope', '')
  const title = document.createElement('strong')
  title.setAttribute('itemprop', 'sender')
  title.textContent = speaker
  item.append(title)
  show_text(item, text)
  conversation.append(item)
  item.scrollIntoView({ block: 'end' })
  return item
}

const show_error = text => {
  let message = text
  try {
    message = JSON.parse(text.replace(/^\d{3}:\s*/, '')).message ?? text
  } catch {}
  status.replaceChildren()
  show_links(status, message.replace(/: quota exceeded\./, '.'))
}

const DATE_LENGTH = 10
const check_limit = async () => {
  try {
    const response = await fetch(
      `/chat/limit?actor=${encodeURIComponent(actor)}`
    )
    const warn = response.ok ? (await response.json()).warn : null
    if (!warn?.message) return
    const key = `brayness-warned ${new Date().toISOString().slice(0, DATE_LENGTH)} ${warn.limit} ${warn.at ?? ''}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    status.replaceChildren()
    show_links(status, warn.message)
  } catch {}
}

const watch = async () => {
  let reply = null
  try {
    const response = await fetch(
      `/chat/events?actor=${encodeURIComponent(actor)}`
    )
    if (!response.ok) throw new Error((await response.text()).trim())
    for await (const record of records(response.body)) {
      if (record.type === 'history') {
        conversation.replaceChildren()
        for (const message of record.messages)
          line(message.role === 'user' ? 'You' : 'Brayness', message.text)
      }
      if (record.type === 'working') set_working(record.on)
      if (record.type === 'user') line('You', record.text)
      if (record.type === 'assistant') reply = null
      if (record.type === 'delta') {
        reply ??= line('Brayness')
        show_text(reply, said.get(reply) + record.text)
        reply.scrollIntoView({ block: 'end' })
      }
      if (record.type === 'assistant_end') {
        if (record.text.trim())
          show_text(reply ?? line('Brayness'), record.text)
        else reply?.remove()
        if (record.error) show_error(record.error)
        else check_limit()
        reply = null
      }
      if (record.type === 'error') throw new Error(record.text)
    }
  } catch (error) {
    show_error(error.message)
  }
  set_working(false)
  setTimeout(watch, RECONNECT_MS)
}

input.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  form.requestSubmit()
})

form.addEventListener('submit', async event => {
  event.preventDefault()
  if (!actor) return
  const message = input.value.trim()
  if (!message) return
  input.value = ''
  fit_input()
  status.textContent = ''
  try {
    const response = await fetch(
      `/chat/message?actor=${encodeURIComponent(actor)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message })
      }
    )
    if (!response.ok) throw new Error((await response.text()).trim())
    for await (const record of records(response.body))
      if (record.type === 'error') throw new Error(record.text)
  } catch (error) {
    show_error(error.message)
    if (!input.value) input.value = message
    fit_input()
  }
})

if (!actor) status.textContent = 'No actor selected.'
else {
  mount_tui()
  WIDE.addEventListener('change', mount_tui)
  watch()
}
