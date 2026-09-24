// The app: a form writes one microdata document, a list reads the directory
// back and shows it. The document is the record - there is no other store.
import { Note, store } from './store.js'

const AUTHOR = '+me'
const notes = document.querySelector('#notes')
const form = document.querySelector('#note')

/** One note element: a microdata document with an itemid. */
const as_element = (id, name, text) => {
  const article = document.createElement('article')
  article.setAttribute('itemid', id)
  article.setAttribute('itemprop', 'notes')

  const title = document.createElement('h2')
  title.setAttribute('itemprop', 'name')
  title.textContent = name

  const body = document.createElement('p')
  body.setAttribute('itemprop', 'text')
  body.textContent = text

  article.append(title, body)
  return article
}

/** Read the directory, newest first, and show each saved document. */
const render = async () => {
  const directory = await store.as_directory(`/${AUTHOR}/notes/`)
  const created = [...(directory?.items ?? [])].sort((a, b) => b - a)

  const documents = await Promise.all(
    created.map(async stamp => {
      const id = `/${AUTHOR}/notes/${stamp}`
      const url = await store.backend.url(await store.paths.storage_path(id))
      const response = await fetch(url)
      return response.ok ? response.text() : ''
    })
  )

  notes.replaceChildren()
  documents.filter(Boolean).forEach(html => notes.insertAdjacentHTML('beforeend', html))
}

form.addEventListener('submit', async event => {
  event.preventDefault()
  const data = new FormData(form)
  const id = `/${AUTHOR}/notes/${Date.now()}`
  await new Note(id).save(as_element(id, data.get('name'), data.get('text')))
  form.reset()
  await render()
})

await render()