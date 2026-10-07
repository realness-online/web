import { load_engine, apply_theme, KEY, paste_encode } from './ghostty-vt.js'
import { draw_frame, cell_metrics } from './render-canvas.js'
import { subliminal } from './themes/subliminal.js'

/**
 * Draw a live actor terminal into `stage`, which holds a canvas and an output.
 * `base` is where the host's `ticket` and `pty` routes live. `open`, when
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
    open = null
  } = {}
) => {
  // Every listener on a shared target is removed by close().
  const removers = []
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options)
    removers.push(() => target.removeEventListener?.(type, handler, options))
  }

  const status = stage.querySelector('output')
  const canvas = stage.querySelector('canvas')
  const ctx = canvas.getContext('2d')

  const FONT_SIZE = 14
  const metrics = cell_metrics(ctx, FONT_SIZE)

  const size_terminal = () => {
    const cols = Math.max(
      20,
      Math.floor((stage.clientWidth - 16) / metrics.width)
    )
    const rows = Math.max(
      6,
      Math.floor((stage.clientHeight - 8) / metrics.height)
    )
    return { cols, rows }
  }

  const engine = await load_engine(wasm_url)

  canvas.addEventListener('click', () => canvas.focus())
  if (focus) canvas.focus()

  let { cols, rows } = size_terminal()
  const term = engine.terminal(cols, rows)
  apply_theme(term, subliminal)
  stage.style.background = `rgb(${subliminal.background.join(',')})`
  const encoder = engine.key_encoder(term)

  let bracketed = false
  let connected = false
  let closed = false
  let raf = 0
  let blink_on = true
  let blink_timer = 0
  let sel = null
  let note = ''
  let note_timer = 0
  const redraw = () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      apply_selection()
      const frame = term.frame()
      draw_frame(ctx, frame, {
        font_size: FONT_SIZE,
        blink_on,
        selection_color: subliminal.selection_background
      })
      status.textContent = note || connection_text()
      schedule_blink(frame)
    })
  }

  const connection_text = () => {
    if (closed) return exited ? 'disconnected' : 'reconnecting...'
    return connected ? '' : 'connecting...'
  }

  const set_note = text => {
    note = text
    clearTimeout(note_timer)
    note_timer = setTimeout(() => {
      note = ''
      redraw()
    }, 1600)
  }

  // Selection lives in viewport cells; re-applied each frame so pi's writes do
  // not drop it.
  const apply_selection = () => {
    if (!sel) return
    try {
      term.select_range(sel.ax, sel.ay, sel.bx, sel.by)
    } catch {
      sel = null
    }
  }

  // Blink only when the terminal asks for it; pi draws its own cursor cell.
  const schedule_blink = frame => {
    clearTimeout(blink_timer)
    if (!frame.cursor.visible || !frame.cursor.blinking) return
    blink_timer = setTimeout(() => {
      blink_on = !blink_on
      redraw()
    }, 530)
  }

  // The wire is the orchestrator's pty protocol: JSON text frames, bytes as
  // base64. {op: "data", data_b64} both ways, {op: "resize", cols, rows} up,
  // {op: "exit", code} down.
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  const query = new URLSearchParams({ cols, rows })
  if (actor) query.set('actor', actor)
  const pty_url = `${scheme}://${location.host}${new URL('pty', base).pathname}`
  // A dropped socket (host restart, idled VM) reconnects; attaching wakes the
  // actor. The holder ignores `exec` when Pi is running, so this is safe either way.
  const RETRY_MS = [500, 1000, 2000, 4000, 8000]
  let ws = null
  let retries = 0
  let exited = false
  // Another page took this terminal. Retrying would take it back, and the two
  // pages would trade it forever; wait for a click here instead.
  let taken = false

  const to_base64 = bytes => {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }

  const from_base64 = text =>
    Uint8Array.from(atob(text), char => char.charCodeAt(0))

  const send_resize = () => {
    if (ws?.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ op: 'resize', cols, rows }))
  }

  const retry = () => {
    status.textContent = 'reconnecting...'
    setTimeout(connect, RETRY_MS[Math.min(retries, RETRY_MS.length - 1)])
    retries += 1
  }

  const connect = async () => {
    if (open) {
      try {
        ws = await open({ cols, rows })
      } catch (error) {
        closed = true
        if (error?.status === 401 || error?.status === 403) {
          exited = true
          set_note('Sign in again to reconnect')
          return
        }
        retry()
        return
      }
      if (exited) return ws.close()
      ws.onopen = on_open
      ws.onmessage = on_message
      ws.onclose = on_close
      return
    }
    // Only a refused sign-in stops; network drops and 5xx retry.
    let ticket
    try {
      const response = await fetch(
        new URL(`ticket?actor=${encodeURIComponent(actor)}`, base),
        { method: 'POST' }
      )
      if (response.status === 401 || response.status === 403) {
        closed = true
        exited = true
        set_note('Sign in through Realness to reconnect')
        return
      }
      if (!response.ok) throw new Error(`ticket ${response.status}`)
      ;({ ticket } = await response.json())
    } catch {
      closed = true
      retry()
      return
    }
    query.set('cols', cols)
    query.set('rows', rows)
    query.set('ticket', ticket)
    ws = new WebSocket(`${pty_url}?${query}`)
    ws.onopen = on_open
    ws.onmessage = on_message
    ws.onclose = on_close
  }

  const on_open = () => {
    if (retries) {
      // A cold boot starts from a bare shell; clear the old screen first.
      term.write(new TextEncoder().encode('\x1bc'))
      redraw()
    }
    connected = true
    closed = false
    retries = 0
    send_resize()
    // exec replaces the shell with a command, so its exit lands in the shell.
    if (exec) send(new TextEncoder().encode(`exec ${exec}\r`))
  }

  const on_message = event => {
    const message = JSON.parse(event.data)
    if (message.op === 'taken') {
      taken = true
      ws.close()
      return
    }
    if (message.op === 'exit') {
      exited = true
      set_note(`exit ${message.code}`)
      ws.close()
      return
    }
    if (message.op !== 'data') return
    const bytes = from_base64(message.data_b64)
    const text = new TextDecoder().decode(bytes)
    if (text.includes('\x1b[?2004h')) bracketed = true
    if (text.includes('\x1b[?2004l')) bracketed = false
    term.write(bytes)
    // pi pushes Kitty keyboard after startup; keep the encoder in sync.
    if (text.includes('\x1b[')) encoder.set_from_terminal(term)
    redraw()
  }

  const on_close = () => {
    connected = false
    closed = true
    if (exited) {
      status.textContent = 'disconnected'
      return
    }
    if (taken) {
      status.textContent = 'open in another tab - click to use here'
      return
    }
    retry()
  }

  connect()
  canvas.addEventListener('click', () => {
    if (!taken) return
    taken = false
    retries = 0
    status.textContent = 'reconnecting...'
    connect()
  })

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

  const LETTER_KEY = {}
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach((letter, index) => {
    LETTER_KEY[letter] = 20 + index // GhosttyKey A..Z
  })

  const send = bytes => {
    if (ws?.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ op: 'data', data_b64: to_base64(bytes) }))
  }

  const clear_scrollback = () => {
    term.clear_scrollback()
    term.scroll_to_bottom()
    sel = null
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
      // Fallback for documents without clipboard permission.
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
      cols - 1,
      Math.max(0, Math.floor((event.clientX - rect.left) / metrics.width))
    )
    const y = Math.min(
      rows - 1,
      Math.max(0, Math.floor((event.clientY - rect.top) / metrics.height))
    )
    return { x, y }
  }

  canvas.addEventListener('mousedown', event => {
    canvas.focus()
    const cell = cell_at(event)
    sel = { ax: cell.x, ay: cell.y, bx: cell.x, by: cell.y }
    redraw()
  })

  listen(window, 'mousemove', event => {
    if (!sel || event.buttons === 0) return
    const cell = cell_at(event)
    if (cell.x === sel.bx && cell.y === sel.by) return
    sel.bx = cell.x
    sel.by = cell.y
    redraw()
  })

  listen(window, 'mouseup', () => {
    if (sel && sel.ax === sel.bx && sel.ay === sel.by) sel = null
    redraw()
  })

  // Wheel scrolls the scrollback. A scroll moves the viewport, so any selection
  // keyed to viewport cells is dropped. An app tracking the mouse (Pi's
  // fullscreen TUI, on the alternate screen) has no scrollback here: it gets
  // SGR wheel reports and scrolls its own history.
  let wheel_px = 0
  canvas.addEventListener(
    'wheel',
    event => {
      event.preventDefault()
      sel = null
      if (term.mouse_tracking()) {
        // Trackpads send many small deltas; one report per row of travel.
        wheel_px +=
          event.deltaMode === 0 ? event.deltaY : event.deltaY * metrics.height
        const steps = Math.trunc(wheel_px / metrics.height)
        if (!steps) return
        wheel_px -= steps * metrics.height
        const { x, y } = cell_at(event)
        // Pi parses one report per read, so each goes out on its own.
        const report = new TextEncoder().encode(
          `\x1b[<${steps > 0 ? 65 : 64};${x + 1};${y + 1}M`
        )
        for (let i = 0; i < Math.min(Math.abs(steps), 10); i++) send(report)
        return
      }
      term.scroll(event.deltaY > 0 ? 3 : -3)
      redraw()
    },
    { passive: false }
  )

  listen(window, 'keydown', event => {
    if (document.activeElement !== canvas) return
    if (event.metaKey && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      clear_scrollback()
      return
    }
    if (event.metaKey && event.key.toLowerCase() === 'c' && sel) {
      event.preventDefault()
      copy_selection()
      return
    }
    if (event.metaKey) return
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
      if (event.altKey) mods |= 4
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
    send(paste_encode(engine, text, bracketed))
  })

  let resize_timer = 0
  listen(window, 'resize', () => {
    clearTimeout(resize_timer)
    resize_timer = setTimeout(() => {
      const next = size_terminal()
      if (next.cols === cols && next.rows === rows) return
      ;({ cols, rows } = next)
      term.resize(cols, rows)
      send_resize()
      redraw()
    }, 150)
  })

  window.brayness = {
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
    resize: (c, r) => {
      cols = c
      rows = r
      term.resize(c, r)
      send_resize()
      redraw()
    }
  }

  redraw()

  return {
    close() {
      exited = true
      closed = true
      for (const remove of removers.splice(0)) remove()
      clearTimeout(blink_timer)
      clearTimeout(note_timer)
      clearTimeout(resize_timer)
      if (raf) cancelAnimationFrame(raf)
      if (window.brayness?.frame) delete window.brayness
      ws?.close()
    }
  }
}
