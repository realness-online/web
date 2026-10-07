import { mount } from './terminal.js'

const params = new URLSearchParams(location.search)
// ?exec=<command> replaces the shell with it. Old links may include
// --continue; refresh always starts a new conversation.
const exec = params.get('exec')?.replace(/ --continue$/, '') ?? null
if (exec) {
  params.set('exec', exec)
  history.replaceState(null, '', `?${params}`)
}
await mount(document.querySelector('main'), {
  actor: params.get('actor'),
  exec
})
