import { current_user } from '@/utils/serverless'
import {
  chat_warning,
  readable_error,
  send_chat,
  watch_chat
} from '@/utils/brayness-chat'
import { ref } from 'vue'

const RECONNECT_MS = 2000
const DAY = 10

/**
 * The actor's one Pi session as a conversation: the watch draws both sides
 * of every turn, and sending only hands Pi the message. Shared by /chat and
 * the chat panel on Thoughts.
 * @param {import('vue').Ref<string | null>} actor
 * @param {{ on_change?: () => void }} [options]
 */
export const use_chat = (actor, { on_change = () => {} } = {}) => {
  const messages = ref([])
  const draft = ref('')
  const status = ref('')
  const working = ref(false)
  let watching = null
  let stopped = false

  /** Near a model-use limit, say so once per step per day. */
  const check_limit = async () => {
    const warn = await chat_warning(current_user.value, actor.value)
    if (!warn) return
    const day = new Date().toISOString().slice(0, DAY)
    const key = `brayness-warned ${day} ${warn.limit} ${warn.at ?? ''}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    status.value = warn.message
  }

  /** One watch record onto the page; returns the reply still streaming. */
  const apply = (record, streaming) => {
    let reply = streaming
    if (record.type === 'history')
      messages.value = record.messages.map(message => ({
        sender: message.role === 'user' ? 'You' : 'Brayness',
        text: message.text
      }))
    if (record.type === 'working') working.value = record.on
    if (record.type === 'user')
      messages.value.push({ sender: 'You', text: record.text })
    if (record.type === 'delta') {
      if (!reply) {
        messages.value.push({ sender: 'Brayness', text: '' })
        reply = messages.value.at(-1)
      }
      reply.text += record.text
    }
    if (record.type === 'assistant_end') {
      if (!record.text.trim()) {
        if (reply) messages.value.splice(messages.value.indexOf(reply), 1)
      } else if (reply) reply.text = record.text
      else messages.value.push({ sender: 'Brayness', text: record.text })
      if (record.error) status.value = readable_error(record.error)
      else check_limit()
      return null
    }
    if (record.type === 'assistant') return null
    if (record.type === 'error') throw new Error(record.text)
    return reply
  }

  const watch = async () => {
    watching = new AbortController()
    let reply = null
    try {
      const records = await watch_chat(current_user.value, actor.value, {
        signal: watching.signal
      })
      for await (const record of records) {
        reply = apply(record, reply)
        on_change()
      }
    } catch (thrown) {
      if (stopped) return
      status.value = readable_error(thrown.message)
    }
    working.value = false
    if (!stopped) setTimeout(watch, RECONNECT_MS)
  }

  const send = async () => {
    const message = draft.value.trim()
    if (!message || !actor.value) return
    draft.value = ''
    status.value = ''
    try {
      await send_chat(current_user.value, actor.value, message)
    } catch (thrown) {
      status.value = readable_error(thrown.message)
      if (!draft.value) draft.value = message
    }
  }

  /** Clears the view only: Pi keeps the session, and a reconnect draws its
      history again. */
  const clear = () => {
    messages.value = []
  }

  const stop = () => {
    stopped = true
    watching?.abort()
  }

  return { messages, draft, status, working, watch, send, clear, stop }
}
