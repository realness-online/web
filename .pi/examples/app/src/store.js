import { create_store } from '@realness.online/store'
import { local } from '@realness.online/store/local'

// Every note lives at /+me/notes/<created>; +me is this browser.
export const AUTHOR = '/+me'

export const { Storage, Local, itemid } = create_store({
  ...local(),
  vocabulary: {
    types: ['notes'],
    requires_timestamp: ['notes'],
    networkable: [],
    archived: [],
    paged: [],
    sizes: { MIN: 1, MID: 5, MAX: 10 }
  }
})

export class Note extends Local(Storage) {}

export const note_id = created => `${AUTHOR}/notes/${created}`

// A saved note is its own HTML; read the microdata back out.
export const load = id => {
  const html = localStorage.getItem(id)
  if (!html) return null
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const prop = name => doc.querySelector(`[itemprop="${name}"]`)?.textContent ?? ''
  return { id, name: prop('name'), text: prop('text') }
}

export const list = () =>
  Object.keys(localStorage)
    .filter(key => itemid.as_type(key) === 'notes')
    .sort((a, b) => itemid.as_created_at(b) - itemid.as_created_at(a))
    .map(load)

export const remove = id => localStorage.removeItem(id)
