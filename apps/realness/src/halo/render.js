import { MS_PER_SECOND } from '#root/lib/units.js'
import { logger } from './log.js'
/* eslint-disable no-await-in-loop -- polling waits between tries */

const LOG = logger('render')
const POLL_MS = 100
const SETTLE_POLL_MS = 250
const LOAD_LIMIT_MS = 30_000
const SETTLE_MS = 10_000
const EVAL_TIMEOUT_MS = 15_000
const SETTLED_FOR_MS = 500
const CONTENT_TEXT = 1000
export const DEVTOOLS_PORT = 9222

const sleep = ms =>
  new Promise(done => {
    setTimeout(done, ms)
  })

/**
 * Where a Chrome's DevTools answer: `host:port` as given, or a bare host on
 * the default port.
 * @param {string} address
 */
export const devtools_at = address =>
  /:\d+$/.test(address) ? address : `${address}:${DEVTOOLS_PORT}`

const devtools = async (address, seconds = 5) => {
  const deadline = Date.now() + seconds * MS_PER_SECOND
  for (;;) {
    try {
      const reply = await fetch(`http://${devtools_at(address)}/json/version`, {
        signal: AbortSignal.timeout(MS_PER_SECOND)
      })
      if (reply.ok) return await reply.json()
    } catch {}
    if (Date.now() > deadline)
      throw new Error(
        `no DevTools on ${devtools_at(address)} after ${seconds}s`
      )
    await sleep(POLL_MS)
  }
}

/**
 * What the page says about itself: whether it has a body and how much text it
 * shows. A page still parsing answers no eval, which is not a failure.
 * @returns {Promise<{ body: boolean, text: number } | null>}
 */
const page_state = async (send, sessionId, wait) => {
  try {
    const { result } = await send(
      'Runtime.evaluate',
      {
        expression:
          wait === 'content'
            ? "JSON.stringify({body: Boolean(document.body), text: (document.body?.innerText ?? '').length})"
            : "(document.body?.innerText ?? '').length",
        returnByValue: true
      },
      sessionId
    )
    return wait === 'content'
      ? JSON.parse(result.value)
      : { body: true, text: Number(result.value) }
  } catch (error) {
    if (/no reply/.test(error.message)) return null
    throw error
  }
}

/**
 * Open `url` in the Chrome at `address`, wait for load, return the document's
 * status and HTML. Standard library only: Node's WebSocket speaks DevTools.
 */
export const render_page = async (
  address,
  url,
  { limit = LOAD_LIMIT_MS, settle_ms = SETTLE_MS, wait = 'load' } = {}
) => {
  const t0 = Date.now()
  const { webSocketDebuggerUrl } = await devtools(address)
  const t1 = Date.now()
  if (wait === 'content') LOG.info(`render ${address} devtools ${t1 - t0}ms`)
  const socket = new WebSocket(webSocketDebuggerUrl)
  await new Promise((done, fail) => {
    socket.onopen = done
    socket.onerror = () => fail(new Error('DevTools socket failed'))
  })
  let next = 0
  const waiting = new Map()
  const events = []
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && waiting.has(message.id)) {
      const { done, fail } = waiting.get(message.id)
      waiting.delete(message.id)
      if (message.error) fail(new Error(message.error.message))
      else done(message.result)
    } else if (message.method) events.push(message)
  }
  const send = (method, params = {}, sessionId) =>
    new Promise((done, fail) => {
      const id = ++next
      const timer = setTimeout(
        () => (
          waiting.delete(id),
          fail(new Error(`${method}: no reply in 15s`))
        ),
        EVAL_TIMEOUT_MS
      )
      waiting.set(id, {
        done: v => (clearTimeout(timer), done(v)),
        fail: e => (clearTimeout(timer), fail(e))
      })
      socket.send(
        JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) })
      )
    })
  try {
    const { targetId } = await send('Target.createTarget', {
      url: 'about:blank'
    })
    const { sessionId } = await send('Target.attachToTarget', {
      targetId,
      flatten: true
    })
    await send('Page.enable', {}, sessionId)
    await send('Network.enable', {}, sessionId)
    await send('Runtime.enable', {}, sessionId)
    await send('Log.enable', {}, sessionId)
    const t2 = Date.now()
    await send('Page.navigate', { url }, sessionId)
    const loaded = () =>
      events.some(
        e => e.sessionId === sessionId && e.method === 'Page.loadEventFired'
      )
    const deadline = Date.now() + limit
    while (!loaded()) {
      if (Date.now() > deadline) break
      await sleep(50)
    }
    const t3 = Date.now()
    const status =
      events.find(
        e =>
          e.sessionId === sessionId &&
          e.method === 'Network.responseReceived' &&
          e.params.type === 'Document'
      )?.params.response.status ?? null
    const settle = Date.now() + settle_ms
    let text_chars = 0
    while (Date.now() < settle) {
      const seen = await page_state(send, sessionId, wait)
      if (seen && wait === 'content') {
        text_chars = seen.text
        if (seen.body && seen.text > CONTENT_TEXT) break
      } else if (seen && seen.text >= SETTLED_FOR_MS) break
      await sleep(SETTLE_POLL_MS)
    }
    const t4 = Date.now()
    if (wait === 'content') {
      LOG.info(
        `render ${address} setup ${t2 - t1}ms, navigate ${t3 - t2}ms, settle ${t4 - t3}ms`
      )
      if (text_chars <= CONTENT_TEXT) {
        const thrown = events.filter(
          e => e.method === 'Runtime.exceptionThrown'
        )
        const failed = events.filter(e => e.method === 'Network.loadingFailed')
        const answered = events.filter(
          e => e.method === 'Network.responseReceived'
        )
        const kinds = {}
        for (const event of answered)
          kinds[event.params.type] = (kinds[event.params.type] ?? 0) + 1
        const logged = events
          .filter(e => e.method === 'Log.entryAdded')
          .map(e => `${e.params.entry.level}: ${e.params.entry.text}`)
        LOG.warn(
          `render ${address} short: text ${text_chars}, ${thrown.length} exception(s), ${failed.length} failed load(s), loads ${JSON.stringify(kinds)}${thrown.length ? `; ${thrown[0].params?.exceptionDetails?.exception?.description?.split('\n')[0] ?? 'unknown'}` : ''}${logged.length ? `; logged: ${logged.slice(0, 3).join(' | ')}` : ''}`
        )
      }
    }
    const html_page = await send(
      'Runtime.evaluate',
      { expression: 'document.documentElement.outerHTML', returnByValue: true },
      sessionId
    )
    return { status, html: html_page.result.value ?? '' }
  } finally {
    socket.close()
  }
}
