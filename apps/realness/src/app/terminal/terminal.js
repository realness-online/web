import { load_engine, apply_theme, KEY, paste_encode } from './ghostty-vt.js'
import { draw_frame, cell_metrics } from './render-canvas.js'
import { realness_theme } from './themes/ghostty-theme.js'

const FONT_SIZE = 14
const MIN_COLS = 20
const MIN_ROWS = 6
const HORIZONTAL_PADDING = 16
const VERTICAL_PADDING = 8
const NOTE_MS = 1600
const BLINK_MS = 530
const RETRY_BASE_MS = 500
const HTTP_UNAUTHORIZED = 401
const HTTP_FORBIDDEN = 403
const LETTER_KEY_START = 20
const WHEEL_UP = 64
const WHEEL_DOWN = 65
const MAX_WHEEL_REPORTS = 10
const SCROLL_ROWS = 3
const ALT_MODIFIER = 4
const RESIZE_MS = 150
const RETRY_MS = Array.from(
  { length: 5 },
  (_, attempt) => RETRY_BASE_MS * 2 ** attempt
)

const KEY_MAP = {
  Escape: KEY.ESCAPE,
  Enter: KEY.ENTER,
  Tab: KEY.TAB,
  Backspace: KEY.BACKSPACE,
  ArrowUp: KEY.ARROW_UP,
  ArrowDown: KEY.ARROW_DOWN,
  ArrowLeft: KEY.ARROW_LEFT,
  ArrowRight: KEY.ARROW_RIGHT,
  Home: KEY.HOME,
  End: KEY.END,
  PageUp: KEY.PAGE_UP,
  PageDown: KEY.PAGE_DOWN,
  Delete: KEY.DELETE
}

/** The keyboard's own character for a physical key, unshifted and shifted. */
const CODE_CHARS = {
  Space: [' ', ' '],
  Comma: [',', '<'],
  Period: ['.', '>'],
  Slash: ['/', '?'],
  Semicolon: [';', ':'],
  Quote: ["'", '"'],
  BracketLeft: ['[', '{'],
  BracketRight: [']', '}'],
  Backslash: ['\\', '|'],
  Minus: ['-', '_'],
  Equal: ['=', '+'],
  Backquote: ['`', '~']
}
const ESC = '\x1b'

/** The character a key types, from its physical code, so Option's symbols do not stand in. */
const code_char = event => {
  const letter = /^Key([A-Z])$/.exec(event.code)?.[1]
  if (letter) return event.shiftKey ? letter : letter.toLowerCase()
  const digit = /^Digit(\d)$/.exec(event.code)?.[1]
  if (digit) return event.shiftKey ? event.key : digit
  const chars = CODE_CHARS[event.code]
  return chars ? chars[event.shiftKey ? 1 : 0] : null
}

/** Option as Meta, as a terminal does: ESC, then the key (M-x, M-<). */
export const meta_bytes = event => {
  if (!event.altKey || event.ctrlKey || event.metaKey) return null
  const char = code_char(event)
  return char ? ESC + char : null
}

/** Control with a symbol: C-SPC, C-/, C-[, C-], C-\\ - what Emacs and Vim expect. */
const CONTROL_SYMBOL = {
  Space: '\x00',
  Digit2: '\x00',
  Slash: '\x1f',
  Minus: '\x1f',
  BracketLeft: ESC,
  BracketRight: '\x1d',
  Backslash: '\x1c'
}
export const control_bytes = event => {
  if (!event.ctrlKey || event.metaKey) return null
  const bytes = CONTROL_SYMBOL[event.code]
  if (!bytes) return null
  return event.altKey ? ESC + bytes : bytes
}

const LETTER_KEY = {}
'abcdefghijklmnopqrstuvwxyz'.split('').forEach((letter, index) => {
  LETTER_KEY[letter] = LETTER_KEY_START + index
})

const create_display = ({ state, term, ctx, status, colors }) => {
  let raf = 0
  let blink_on = true
  let blink_timer = 0
  let note = ''
  let note_timer = 0
  const redraw = () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      apply_selection()
      const frame = term.frame()
      const focused = document.activeElement === ctx.canvas
      draw_frame(ctx, frame, {
        font_size: FONT_SIZE,
        blink_on,
        focused,
        selection_color: colors.selection_background
      })
      status.textContent = note || connection_text()
      schedule_blink(frame, focused)
    })
  }

  const connection_text = () => {
    if (state.closed) return state.exited ? 'disconnected' : 'reconnecting...'
    return state.connected ? '' : 'connecting...'
  }

  const set_note = text => {
    note = text
    clearTimeout(note_timer)
    note_timer = setTimeout(() => {
      note = ''
      redraw()
    }, NOTE_MS)
  }

  const apply_selection = () => {
    if (!state.sel) return
    try {
      term.select_range(state.sel.ax, state.sel.ay, state.sel.bx, state.sel.by)
    } catch {
      state.sel = null
    }
  }

  const schedule_blink = (frame, focused) => {
    clearTimeout(blink_timer)
    if (!frame.cursor.visible || !focused) return
    blink_timer = setTimeout(() => {
      blink_on = !blink_on
      redraw()
    }, BLINK_MS)
  }

  return {
    redraw,
    set_note,
    /** Show the cursor at once after a focus change, then blink from there. */
    wake_cursor() {
      blink_on = true
      redraw()
    },
    close() {
      clearTimeout(blink_timer)
      clearTimeout(note_timer)
      if (raf) cancelAnimationFrame(raf)
    }
  }
}

const create_connection = (
  { state, term, encoder, canvas, status, redraw, set_note },
  { actor, exec, base, open }
) => {
  const send = bytes => {
    if (ws?.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ op: 'data', data_b64: to_base64(bytes) }))
  }

  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  const query = new URLSearchParams({ cols: state.cols, rows: state.rows })
  if (actor) query.set('actor', actor)
  const pty_url = `${scheme}://${location.host}${new URL('pty', base).pathname}`
  /** @type {WebSocket | null} */
  let ws = null
  let retries = 0
  let retry_timer = 0
  let dialing = false
  let live = false

  const to_base64 = bytes => {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }

  const from_base64 = text =>
    Uint8Array.from(atob(text), char => char.charCodeAt(0))

  const send_resize = () => {
    if (ws?.readyState === WebSocket.OPEN)
      ws.send(
        JSON.stringify({ op: 'resize', cols: state.cols, rows: state.rows })
      )
  }

  const retry = () => {
    status.textContent = 'reconnecting...'
    retry_timer = setTimeout(
      connect,
      RETRY_MS[Math.min(retries, RETRY_MS.length - 1)]
    )
    retries += 1
  }

  /** @param {WebSocket} socket */
  const attach = socket => {
    ws = socket
    live = true
    socket.onopen = on_open
    socket.onmessage = on_message
    socket.onclose = on_close
  }

  const connect = async () => {
    if (state.exited || dialing || live) return
    dialing = true
    try {
      await dial()
    } finally {
      dialing = false
    }
  }

  const dial = async () => {
    if (open) {
      let socket
      try {
        socket = await open({ cols: state.cols, rows: state.rows })
      } catch (error) {
        if (state.exited) return
        state.closed = true
        if (
          error?.status === HTTP_UNAUTHORIZED ||
          error?.status === HTTP_FORBIDDEN
        ) {
          state.exited = true
          set_note('Sign in again to reconnect')
          return
        }
        retry()
        return
      }
      if (state.exited) return socket.close()
      attach(socket)
      return
    }
    let ticket
    try {
      const response = await fetch(
        new URL(`ticket?actor=${encodeURIComponent(actor)}`, base),
        {
          method: 'POST'
        }
      )
      if (
        response.status === HTTP_UNAUTHORIZED ||
        response.status === HTTP_FORBIDDEN
      ) {
        state.closed = true
        state.exited = true
        set_note('Sign in through Realness to reconnect')
        return
      }
      if (!response.ok) throw new Error(`ticket ${response.status}`)
      ;({ ticket } = await response.json())
    } catch {
      state.closed = true
      retry()
      return
    }
    query.set('cols', state.cols)
    query.set('rows', state.rows)
    query.set('ticket', ticket)
    attach(new WebSocket(`${pty_url}?${query}`))
  }

  const on_open = () => {
    if (retries) {
      term.write(new TextEncoder().encode('\x1bc'))
      redraw()
    }
    state.connected = true
    state.closed = false
    retries = 0
    send_resize()
    if (exec) send(new TextEncoder().encode(`exec ${exec}\r`))
  }

  const on_message = event => {
    const message = JSON.parse(event.data)
    if (message.op === 'taken') {
      state.taken = true
      ws?.close()
      return
    }
    if (message.op === 'exit') {
      state.exited = true
      set_note(`exit ${message.code}`)
      ws?.close()
      return
    }
    if (message.op !== 'data') return
    const bytes = from_base64(message.data_b64)
    const text = new TextDecoder().decode(bytes)
    if (text.includes('\x1b[?2004h')) state.bracketed = true
    if (text.includes('\x1b[?2004l')) state.bracketed = false
    term.write(bytes)
    if (text.includes('\x1b[')) encoder.set_from_terminal(term)
    redraw()
  }

  const on_close = () => {
    live = false
    state.connected = false
    state.closed = true
    if (state.exited) {
      status.textContent = 'disconnected'
      return
    }
    if (state.taken) {
      status.textContent = 'open in another tab - click to use here'
      return
    }
    retry()
  }

  connect()
  canvas.addEventListener('click', () => {
    if (!state.taken) return
    state.taken = false
    retries = 0
    status.textContent = 'reconnecting...'
    connect()
  })

  /** A background tab's retry timer can be held back for minutes; returning to the tab retries at once. */
  const on_visible = () => {
    if (document.visibilityState !== 'visible') return
    if (!state.closed || state.exited || state.taken) return
    clearTimeout(retry_timer)
    retries = 0
    connect()
  }
  document.addEventListener('visibilitychange', on_visible)

  return {
    send,
    send_resize,
    close() {
      state.exited = true
      state.closed = true
      document.removeEventListener('visibilitychange', on_visible)
      clearTimeout(retry_timer)
      ws?.close()
    }
  }
}

const bind_selection = ({
  state,
  term,
  canvas,
  metrics,
  listen,
  send,
  redraw,
  set_note
}) => {
  const clear_scrollback = () => {
    term.clear_scrollback()
    term.scroll_to_bottom()
    state.sel = null
    set_note('scrollback cleared')
    redraw()
  }

  const copy_selection = async () => {
    const text = term.selection_text()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      set_note(`copied ${text.length} chars`)
    } catch {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      set_note(ok ? `copied ${text.length} chars` : 'copy failed')
    }
    redraw()
  }

  const cell_at = event => {
    const rect = canvas.getBoundingClientRect()
    const x = Math.min(
      state.cols - 1,
      Math.max(0, Math.floor((event.clientX - rect.left) / metrics.width))
    )
    const y = Math.min(
      state.rows - 1,
      Math.max(0, Math.floor((event.clientY - rect.top) / metrics.height))
    )
    return { x, y }
  }

  canvas.addEventListener('mousedown', event => {
    canvas.focus()
    const cell = cell_at(event)
    state.sel = { ax: cell.x, ay: cell.y, bx: cell.x, by: cell.y }
    redraw()
  })

  listen(window, 'mousemove', event => {
    if (!state.sel || event.buttons === 0) return
    const cell = cell_at(event)
    if (cell.x === state.sel.bx && cell.y === state.sel.by) return
    state.sel.bx = cell.x
    state.sel.by = cell.y
    redraw()
  })

  listen(window, 'mouseup', () => {
    if (
      state.sel &&
      state.sel.ax === state.sel.bx &&
      state.sel.ay === state.sel.by
    )
      state.sel = null
    redraw()
  })

  let wheel_px = 0
  canvas.addEventListener(
    'wheel',
    event => {
      event.preventDefault()
      state.sel = null
      if (term.mouse_tracking()) {
        wheel_px +=
          event.deltaMode === 0 ? event.deltaY : event.deltaY * metrics.height
        const steps = Math.trunc(wheel_px / metrics.height)
        if (!steps) return
        wheel_px -= steps * metrics.height
        const { x, y } = cell_at(event)
        const report = new TextEncoder().encode(
          `\x1b[<${steps > 0 ? WHEEL_DOWN : WHEEL_UP};${x + 1};${y + 1}M`
        )
        for (let i = 0; i < Math.min(Math.abs(steps), MAX_WHEEL_REPORTS); i++)
          send(report)
        return
      }
      term.scroll(event.deltaY > 0 ? SCROLL_ROWS : -SCROLL_ROWS)
      redraw()
    },
    { passive: false }
  )

  return { clear_scrollback, copy_selection }
}

const bind_keyboard = ({
  state,
  canvas,
  encoder,
  engine,
  listen,
  send,
  clear_scrollback,
  copy_selection
}) => {
  listen(window, 'keydown', event => {
    if (document.activeElement !== canvas) return
    if (event.metaKey && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      clear_scrollback()
      return
    }
    if (event.metaKey && event.key.toLowerCase() === 'c' && state.sel) {
      event.preventDefault()
      copy_selection()
      return
    }
    if (event.metaKey) return
    const alt_letter = /^Key([A-Z])$/.exec(event.code)?.[1]?.toLowerCase()
    if (event.altKey && !event.ctrlKey && alt_letter) {
      event.preventDefault()
      send(
        encoder.encode({
          key: LETTER_KEY[alt_letter],
          mods: ALT_MODIFIER | (event.shiftKey ? 1 : 0),
          utf8: event.shiftKey ? alt_letter.toUpperCase() : alt_letter,
          unshifted_codepoint: alt_letter.codePointAt(0)
        })
      )
      return
    }
    const special = control_bytes(event) ?? meta_bytes(event)
    if (special) {
      event.preventDefault()
      send(new TextEncoder().encode(special))
      return
    }
    const letter = event.key.toLowerCase()
    if (event.ctrlKey && LETTER_KEY[letter]) {
      event.preventDefault()
      send(
        encoder.encode({
          key: LETTER_KEY[letter],
          mods: 2,
          utf8: letter,
          unshifted_codepoint: letter.codePointAt(0)
        })
      )
      return
    }
    if (KEY_MAP[event.key]) {
      event.preventDefault()
      let mods = 0
      if (event.shiftKey) mods |= 1
      if (event.ctrlKey) mods |= 2
      if (event.altKey) mods |= ALT_MODIFIER
      send(encoder.encode({ key: KEY_MAP[event.key], mods }))
      return
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      send(new TextEncoder().encode(event.key))
    }
  })

  listen(window, 'paste', event => {
    if (document.activeElement !== canvas) return
    const text = event.clipboardData.getData('text')
    if (!text) return
    event.preventDefault()
    send(paste_encode(engine, text, state.bracketed))
  })
}

/**
 * Draw a live actor terminal into `stage`, which holds a canvas and an output.
 * `base` is where the halo's `ticket` and `pty` routes live. `open`, when
 * given, makes the socket instead: ({ cols, rows }) => WebSocket; a thrown
 * error with status 401 or 403 stops reconnecting. Returns { close }.
 */
export const mount = async (
  stage,
  {
    actor = null,
    exec = null,
    base = document.baseURI,
    wasm_url = new URL('ghostty-vt.wasm', document.baseURI),
    focus = true,
    open = null,
    scheme = matchMedia('(prefers-color-scheme: dark)'),
    load_theme = () => realness_theme(scheme.matches ? 'dark' : 'light')
  } = {}
) => {
  const removers = []
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options)
    removers.push(() => target.removeEventListener?.(type, handler, options))
  }
  const status = stage.querySelector('output')
  const canvas = stage.querySelector('canvas')
  const ctx = canvas.getContext('2d')
  const metrics = cell_metrics(ctx, FONT_SIZE)
  const size_terminal = () => ({
    cols: Math.max(
      MIN_COLS,
      Math.floor((stage.clientWidth - HORIZONTAL_PADDING) / metrics.width)
    ),
    rows: Math.max(
      MIN_ROWS,
      Math.floor((stage.clientHeight - VERTICAL_PADDING) / metrics.height)
    )
  })
  const engine = await load_engine(wasm_url)
  canvas.addEventListener('click', () => canvas.focus())
  if (focus) canvas.focus()
  const state = {
    ...size_terminal(),
    bracketed: false,
    connected: false,
    closed: false,
    exited: false,
    taken: false,
    sel: null
  }
  const term = engine.terminal(state.cols, state.rows)
  const colors = {}
  const use_theme = theme => {
    Object.assign(colors, theme)
    apply_theme(term, theme)
    stage.style.background = `rgb(${theme.background.join(',')})`
  }
  use_theme(await load_theme())
  const encoder = engine.key_encoder(term)
  const display = create_display({ state, term, ctx, status, colors })
  for (const event of ['focus', 'blur'])
    canvas.addEventListener(event, () => display.wake_cursor())
  const { redraw, set_note } = display
  listen(scheme, 'change', async () => {
    use_theme(await load_theme())
    redraw()
  })
  const connection = create_connection(
    { state, term, encoder, canvas, status, redraw, set_note },
    { actor, exec, base, open }
  )
  const { send, send_resize } = connection
  const selection = bind_selection({
    state,
    term,
    canvas,
    metrics,
    listen,
    send,
    redraw,
    set_note
  })
  bind_keyboard({ state, canvas, encoder, engine, listen, send, ...selection })
  const { clear_scrollback, copy_selection } = selection
  let resize_timer = 0
  listen(window, 'resize', () => {
    clearTimeout(resize_timer)
    resize_timer = setTimeout(() => {
      const next = size_terminal()
      if (next.cols === state.cols && next.rows === state.rows) return
      Object.assign(state, next)
      term.resize(state.cols, state.rows)
      send_resize()
      redraw()
    }, RESIZE_MS)
  })
  window.realness = {
    frame: () => term.frame(),
    screen_text: () => term.screen_text(),
    selection_text: () => term.selection_text(),
    scrollbar: () => term.scrollbar(),
    clear_scrollback,
    scroll: delta => {
      term.scroll(delta)
      redraw()
    },
    copy: copy_selection,
    resize: (cols, rows) => {
      state.cols = cols
      state.rows = rows
      term.resize(cols, rows)
      send_resize()
      redraw()
    }
  }
  redraw()
  return {
    close() {
      state.exited = true
      state.closed = true
      for (const remove of removers.splice(0)) remove()
      display.close()
      clearTimeout(resize_timer)
      if (window.realness?.frame) delete window.realness
      connection.close()
    }
  }
}
