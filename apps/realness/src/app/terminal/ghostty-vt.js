/**
 * Every libghostty-vt ABI value this module hardcodes. Keys match the C enum
 * member names and struct field names. `specs/app/terminal/abi.spec.js` checks
 * each against the engine's own `ghostty_type_json()`.
 */
export const LAYOUT = {
  result: {
    SUCCESS: 0,
    OUT_OF_SPACE: -3,
    NO_VALUE: -4
  },
  render_state_data: {
    COLS: 1,
    ROWS: 2,
    DIRTY: 3,
    ROW_ITERATOR: 4,
    CURSOR: 18,
    COLORS: 19
  },
  render_state_row_data: { DIRTY: 1, CELLS: 3, SELECTION: 4 },
  render_state_row_cells_data: {
    STYLE: 2,
    BG_COLOR: 5,
    FG_COLOR: 6,
    SELECTED: 7,
    GRAPHEMES_UTF8: 9
  },
  style: { size: 16, fg_color: 0, bg_color: 4, flags: 12 },
  style_color: { size: 4, tag: 0, rgb: 1, palette: 1 },
  style_color_tag: { NONE: 0, PALETTE: 1, RGB: 2 },
  style_flags: {
    bold: 0,
    italic: 1,
    faint: 2,
    blink: 3,
    inverse: 4,
    invisible: 5,
    strikethrough: 6,
    overline: 7,
    underline: 8,
    underline_width: 3
  },
  render_state_colors: {
    size: 784,
    background: 4,
    foreground: 7,
    cursor: 10,
    palette: 14
  },
  render_state_cursor: {
    size: 20,
    viewport_has_value: 4,
    viewport_x: 6,
    viewport_y: 8,
    visible: 11,
    blinking: 12,
    visual_style: 16
  },
  render_state_row_selection: { size: 8, start_x: 4, end_x: 6 },
  terminal_option: {
    SELECTION: 22,
    SCROLLBACK_MAX_BYTES: 28,
    COLOR_FOREGROUND: 12,
    COLOR_BACKGROUND: 13,
    COLOR_CURSOR: 14,
    COLOR_PALETTE: 15
  },
  terminal_data: { SCROLLBAR: 9, MOUSE_TRACKING: 11, SELECTION: 31 },
  terminal_scroll_viewport_tag: { TOP: 0, BOTTOM: 1, DELTA: 2, ROW: 3 },
  terminal_scroll_viewport: { size: 24, tag: 0, delta: 8 },
  terminal_scrollbar: { size: 24, total: 0, offset: 8, len: 16 },
  formatter_format: { PLAIN: 0 },
  formatter_option: { EMIT: 1, TRIM: 3, SELECTION: 4 },
  point_tag: { VIEWPORT: 1 },
  point: { size: 24, tag: 0, x: 8, y: 12 },
  grid_ref: { size: 8, x: 4, y: 6 },
  selection: { size: 20, start: 0, end: 8, rectangle: 16 },
  buffer: { size: 12, ptr: 0, cap: 4, len: 8 },
  key_action: { RELEASE: 0, PRESS: 1, REPEAT: 2 },
  key: {
    ESCAPE: 120,
    ENTER: 58,
    TAB: 64,
    BACKSPACE: 53,
    ARROW_UP: 78,
    ARROW_DOWN: 75,
    ARROW_LEFT: 76,
    ARROW_RIGHT: 77,
    HOME: 71,
    END: 69,
    PAGE_UP: 74,
    PAGE_DOWN: 73,
    DELETE: 68,
    SPACE: 63
  }
}

const { SUCCESS } = LAYOUT.result
const { NO_VALUE } = LAYOUT.result
const { OUT_OF_SPACE } = LAYOUT.result
const DATA = LAYOUT.render_state_data
const ROW_DATA = LAYOUT.render_state_row_data
const CELL_DATA = LAYOUT.render_state_row_cells_data
const SCROLL = LAYOUT.terminal_scroll_viewport_tag

export const KEY = LAYOUT.key

const DEFAULT_CELL_HEIGHT = 16

/**
 * Apply a theme to a terminal: default fg/bg/cursor and the 256-color palette.
 * Indices 0-15 come from the theme; 16-255 are generated from bg/fg.
 * @param {Terminal} terminal
 * @param {{background: number[], foreground: number[], cursor: number[], palette: number[][]}} theme
 */
export const apply_theme = (terminal, theme) => {
  const PALETTE_LENGTH = 256
  const e = terminal.engine

  const set_rgb = (option, rgb) => {
    const ptr = e.alloc(3)
    const bytes = e.bytes()
    bytes.set(rgb, ptr)
    const result = e.ex.ghostty_terminal_set(terminal.handle, option, ptr)
    e.free(ptr, 3)
    if (result !== SUCCESS) throw new Error(`theme option ${option}: ${result}`)
  }
  set_rgb(LAYOUT.terminal_option.COLOR_FOREGROUND, theme.foreground)
  set_rgb(LAYOUT.terminal_option.COLOR_BACKGROUND, theme.background)
  set_rgb(LAYOUT.terminal_option.COLOR_CURSOR, theme.cursor)

  const base = e.alloc(PALETTE_LENGTH * 3)
  const out = e.alloc(PALETTE_LENGTH * 3)
  const bg_ptr = e.alloc(3)
  const fg_ptr = e.alloc(3)
  const bytes = e.bytes()
  theme.palette.forEach((rgb, index) => {
    bytes.set(rgb, base + index * 3)
  })
  const put = (ptr, rgb) => {
    bytes.set(rgb, ptr)
  }
  put(bg_ptr, theme.background)
  put(fg_ptr, theme.foreground)

  e.ex.ghostty_color_palette_generate(base, 0, bg_ptr, fg_ptr, 1, out)
  const result = e.ex.ghostty_terminal_set(
    terminal.handle,
    LAYOUT.terminal_option.COLOR_PALETTE,
    out
  )
  e.free(base, PALETTE_LENGTH * 3)
  e.free(out, PALETTE_LENGTH * 3)
  e.free(bg_ptr, 3)
  e.free(fg_ptr, 3)
  if (result !== SUCCESS) throw new Error(`theme palette: ${result}`)
}

/**
 * Load the wasm engine and return a Terminal factory.
 * @param {URL|string|Uint8Array|ArrayBuffer} source bytes, or a URL to fetch
 */
export const load_engine = async source => {
  const bytes = await to_bytes(source)
  const { instance } = await WebAssembly.instantiate(
    /** @type {BufferSource} */ (bytes),
    { env: { log: () => {} } }
  )
  const engine = new Engine(instance.exports)
  check_version(engine)
  return engine
}

const VERSION_MAJOR = 1

const check_version = engine => {
  const ptr = engine.ex.ghostty_version()
  const memory = engine.bytes()
  let end = ptr
  while (memory[end] !== 0) end++
  const version = new TextDecoder().decode(memory.slice(ptr, end))
  if (Number(version.split('.')[0]) !== VERSION_MAJOR)
    throw new Error(`ghostty-vt ${version}, expected ${VERSION_MAJOR}.x`)
}

const to_bytes = async source => {
  if (source instanceof Uint8Array || source instanceof ArrayBuffer)
    return source
  const response = await fetch(source)
  return new Uint8Array(await response.arrayBuffer())
}

class Engine {
  constructor(ex) {
    this.ex = ex
  }

  /** @returns {Uint8Array} a live view of wasm memory */
  bytes() {
    return new Uint8Array(this.ex.memory.buffer)
  }

  /** @returns {DataView} a live view of wasm memory */
  view() {
    return new DataView(this.ex.memory.buffer)
  }

  alloc(len) {
    const ptr = this.ex.ghostty_wasm_alloc(len)
    if (ptr === 0) throw new Error(`wasm alloc failed for ${len} bytes`)
    return ptr
  }

  free(ptr, len) {
    this.ex.ghostty_wasm_free(ptr, len)
  }

  /** Allocate an opaque out-parameter slot (4 bytes). */
  alloc_opaque() {
    const ptr = this.ex.ghostty_wasm_alloc_opaque()
    if (ptr === 0) throw new Error('wasm opaque alloc failed')
    return ptr
  }

  free_opaque(ptr) {
    this.ex.ghostty_wasm_free_opaque(ptr)
  }

  take_opaque(slot) {
    return this.ex.ghostty_wasm_take_opaque(slot)
  }

  write_bytes(ptr, data) {
    this.bytes().set(data, ptr)
  }

  read_u32(ptr) {
    return this.view().getUint32(ptr, true)
  }

  /**
   * Create a terminal and copy a VT stream into it.
   * @param {number} cols
   * @param {number} rows
   * @returns {Terminal}
   */
  terminal(cols, rows) {
    const slot = this.alloc_opaque()
    const result = this.ex.ghostty_terminal_new(0, slot, cols, rows)
    if (result !== SUCCESS) throw new Error(`ghostty_terminal_new: ${result}`)
    const handle = this.take_opaque(slot)
    this.free_opaque(slot)
    return new Terminal(this, handle, cols, rows)
  }

  /**
   * Create a key encoder, seeded from the terminal's current modes.
   * @param {Terminal} terminal
   * @returns {Encoder}
   */
  key_encoder(terminal) {
    const slot = this.alloc_opaque()
    const result = this.ex.ghostty_key_encoder_new(0, slot)
    if (result !== SUCCESS)
      throw new Error(`ghostty_key_encoder_new: ${result}`)
    const handle = this.take_opaque(slot)
    this.free_opaque(slot)
    const encoder = new Encoder(this, handle)
    if (terminal) encoder.set_from_terminal(terminal)
    return encoder
  }
}

class Encoder {
  constructor(engine, handle) {
    this.engine = engine
    this.handle = handle
  }

  set_from_terminal(terminal) {
    const result = this.engine.ex.ghostty_key_encoder_set_from_terminal(
      this.handle,
      terminal.handle
    )
    if (result !== SUCCESS)
      throw new Error(`ghostty_key_encoder_set_from_terminal: ${result}`)
  }

  set_option(option, value) {
    const e = this.engine
    const ptr = e.alloc(1)
    e.bytes()[ptr] = value
    e.ex.ghostty_key_encoder_set(this.handle, option, ptr)
    e.free(ptr, 1)
  }

  /**
   * Encode one key event to the bytes to send to the pty.
   * @param {{key: number, mods?: number, action?: number, utf8?: string, unshifted_codepoint?: number}} event
   * @returns {Uint8Array}
   */
  encode(event) {
    const ENCODE_BUFFER_SIZE = 256
    const U32_SIZE = 4
    const e = this.engine
    const { ex } = e
    const slot = e.alloc_opaque()
    let result = ex.ghostty_key_event_new(0, slot)
    if (result !== SUCCESS) throw new Error(`ghostty_key_event_new: ${result}`)
    const handle = e.take_opaque(slot)
    e.free_opaque(slot)

    ex.ghostty_key_event_set_action(
      handle,
      event.action ?? LAYOUT.key_action.PRESS
    )
    ex.ghostty_key_event_set_key(handle, event.key)
    ex.ghostty_key_event_set_mods(handle, event.mods ?? 0)
    if (event.unshifted_codepoint !== undefined)
      ex.ghostty_key_event_set_unshifted_codepoint(
        handle,
        event.unshifted_codepoint
      )

    let utf8_ptr = 0
    let utf8_len = 0
    if (event.utf8) {
      const bytes = new TextEncoder().encode(event.utf8)
      utf8_ptr = e.alloc(bytes.length)
      e.write_bytes(utf8_ptr, bytes)
      utf8_len = bytes.length
      ex.ghostty_key_event_set_utf8(handle, utf8_ptr, utf8_len)
    }

    const out = e.alloc(ENCODE_BUFFER_SIZE)
    const written_ptr = e.alloc(U32_SIZE)
    result = ex.ghostty_key_encoder_encode(
      this.handle,
      handle,
      out,
      ENCODE_BUFFER_SIZE,
      written_ptr
    )
    if (result !== SUCCESS)
      throw new Error(`ghostty_key_encoder_encode: ${result}`)
    const written = e.read_u32(written_ptr)
    const bytes = e.bytes().slice(out, out + written)

    e.free(out, ENCODE_BUFFER_SIZE)
    e.free(written_ptr, U32_SIZE)
    if (utf8_ptr) e.free(utf8_ptr, utf8_len)
    ex.ghostty_key_event_free(handle)
    return bytes
  }

  free() {
    this.engine.ex.ghostty_key_encoder_free(this.handle)
  }
}

/** Wrap paste text the way the terminal would. Modifies nothing of the input. */
export const paste_encode = (engine, text, bracketed) => {
  const PASTE_OVERHEAD = 16
  const U32_SIZE = 4
  const e = engine
  const bytes = new TextEncoder().encode(text)
  const data_ptr = e.alloc(bytes.length)
  e.write_bytes(data_ptr, bytes)
  const out = e.alloc(bytes.length + PASTE_OVERHEAD)
  const written_ptr = e.alloc(U32_SIZE)
  const result = e.ex.ghostty_paste_encode(
    data_ptr,
    bytes.length,
    bracketed,
    out,
    bytes.length + PASTE_OVERHEAD,
    written_ptr
  )
  if (result !== SUCCESS) throw new Error(`ghostty_paste_encode: ${result}`)
  const written = e.read_u32(written_ptr)
  const encoded = e.bytes().slice(out, out + written)
  e.free(data_ptr, bytes.length)
  e.free(out, bytes.length + PASTE_OVERHEAD)
  e.free(written_ptr, U32_SIZE)
  return encoded
}

class Terminal {
  constructor(engine, handle, cols, rows) {
    this.engine = engine
    this.handle = handle
    this.cols = cols
    this.rows = rows
  }

  /**
   * Feed VT-encoded bytes. Strings are encoded as UTF-8.
   * @param {string|Uint8Array} data
   */
  write(data) {
    const bytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : data
    const ptr = this.engine.alloc(Math.max(bytes.length, 1))
    this.engine.write_bytes(ptr, bytes)
    this.engine.ex.ghostty_terminal_vt_write(this.handle, ptr, bytes.length)
    this.engine.free(ptr, Math.max(bytes.length, 1))
  }

  resize(cols, rows, cell_width_px = 8, cell_height_px = DEFAULT_CELL_HEIGHT) {
    const result = this.engine.ex.ghostty_terminal_resize(
      this.handle,
      cols,
      rows,
      cell_width_px,
      cell_height_px
    )
    if (result !== SUCCESS)
      throw new Error(`ghostty_terminal_resize: ${result}`)
    this.cols = cols
    this.rows = rows
  }

  /**
   * Read one full frame as plain data a canvas renderer can draw.
   * @returns {{cols: number, rows: number, dirty: number, cursor: object, colors: object, rows_data: Array}}
   */
  frame() {
    const TEXT_BUFFER_SIZE = 256
    const e = this.engine
    const { ex } = e

    const state_slot = e.alloc_opaque()
    let result = ex.ghostty_render_state_new(0, state_slot)
    if (result !== SUCCESS)
      throw new Error(`ghostty_render_state_new: ${result}`)
    const state = e.take_opaque(state_slot)

    result = ex.ghostty_render_state_update(state, this.handle)
    if (result !== SUCCESS)
      throw new Error(`ghostty_render_state_update: ${result}`)

    const dirty = this.#read_state_u32(state, DATA.DIRTY)

    const colors = this.#read_colors(state)
    const cursor = this.#read_cursor(state)

    const iterator_slot = e.alloc_opaque()
    result = ex.ghostty_render_state_row_iterator_new(0, iterator_slot)
    if (result !== SUCCESS) throw new Error(`row_iterator_new: ${result}`)
    result = ex.ghostty_render_state_get(
      state,
      DATA.ROW_ITERATOR,
      iterator_slot
    )
    if (result !== SUCCESS) throw new Error(`row_iterator get: ${result}`)
    const iterator = e.take_opaque(iterator_slot)

    const cells_slot = e.alloc_opaque()
    result = ex.ghostty_render_state_row_cells_new(0, cells_slot)
    if (result !== SUCCESS) throw new Error(`row_cells_new: ${result}`)
    const cells = e.take_opaque(cells_slot)

    const text_ptr = e.alloc(TEXT_BUFFER_SIZE)
    const buffer_ptr = e.alloc(LAYOUT.buffer.size)
    const style_ptr = e.alloc(LAYOUT.style.size)
    const selection_ptr = e.alloc(LAYOUT.render_state_row_selection.size)

    const rows_data = []
    while (ex.ghostty_render_state_row_iterator_next(iterator)) {
      e.view().setUint32(cells_slot, cells, true)
      result = ex.ghostty_render_state_row_get(
        iterator,
        ROW_DATA.CELLS,
        cells_slot
      )
      if (result !== SUCCESS) throw new Error(`row cells get: ${result}`)

      const row_cells = e.read_u32(cells_slot) || cells

      const selection = this.#read_row_selection(iterator, selection_ptr)

      const row_cells_data = []
      while (ex.ghostty_render_state_row_cells_next(row_cells)) {
        const text = this.#read_graphemes(row_cells, buffer_ptr, text_ptr)
        const fg = this.#read_color(row_cells, CELL_DATA.FG_COLOR)
        const bg = this.#read_color(row_cells, CELL_DATA.BG_COLOR)
        const selected = this.#read_bool(row_cells, CELL_DATA.SELECTED)

        result = ex.ghostty_render_state_row_cells_get(
          row_cells,
          CELL_DATA.STYLE,
          style_ptr
        )
        const flags = result === SUCCESS ? this.#read_flags(style_ptr) : 0

        row_cells_data.push({ text, fg, bg, flags, selected })
      }

      rows_data.push({
        dirty: this.#read_row_dirty(iterator, 1),
        selection,
        cells: row_cells_data
      })
    }

    e.free(text_ptr, TEXT_BUFFER_SIZE)
    e.free(buffer_ptr, LAYOUT.buffer.size)
    e.free(style_ptr, LAYOUT.style.size)
    e.free(selection_ptr, LAYOUT.render_state_row_selection.size)
    ex.ghostty_render_state_row_cells_free(cells)
    ex.ghostty_render_state_row_iterator_free(iterator)
    ex.ghostty_render_state_free(state)
    e.free_opaque(cells_slot)
    e.free_opaque(iterator_slot)
    e.free_opaque(state_slot)

    return {
      cols: this.cols,
      rows: this.rows,
      dirty,
      cursor,
      colors,
      rows_data
    }
  }

  /** Screen text, one string per row, trailing blanks trimmed. Used by checks. */
  screen_text() {
    const frame = this.frame()
    return frame.rows_data
      .map(row =>
        row.cells
          .map(c => c.text || ' ')
          .join('')
          .replace(/\s+$/, '')
      )
      .join('\n')
  }

  /** Select the range between two viewport cells (inclusive). */
  select_range(x1, y1, x2, y2) {
    const e = this.engine
    const { selection, grid_ref } = LAYOUT
    const start = this.#grid_ref(x1, y1)
    const end = this.#grid_ref(x2, y2)
    const sel = e.alloc(selection.size)
    e.bytes().copyWithin(sel + selection.start, start, start + grid_ref.size)
    e.bytes().copyWithin(sel + selection.end, end, end + grid_ref.size)
    e.bytes()[sel + selection.rectangle] = 0
    const result = e.ex.ghostty_terminal_set(
      this.handle,
      LAYOUT.terminal_option.SELECTION,
      sel
    )
    e.free(start, grid_ref.size)
    e.free(end, grid_ref.size)
    e.free(sel, selection.size)
    if (result !== SUCCESS) throw new Error(`set selection: ${result}`)
  }

  select_all() {
    const e = this.engine
    const sel = e.alloc(LAYOUT.selection.size)
    const result = e.ex.ghostty_terminal_select_all(this.handle, sel)
    if (result === NO_VALUE) {
      e.free(sel, LAYOUT.selection.size)
      return false
    }
    if (result !== SUCCESS) {
      e.free(sel, LAYOUT.selection.size)
      throw new Error(`select_all: ${result}`)
    }
    const set = e.ex.ghostty_terminal_set(
      this.handle,
      LAYOUT.terminal_option.SELECTION,
      sel
    )
    e.free(sel, LAYOUT.selection.size)
    if (set !== SUCCESS) throw new Error(`set selection: ${set}`)
    return true
  }

  /** The active selection as plain text, or "" when there is none. */
  selection_text() {
    const U32_SIZE = 4
    const e = this.engine
    const { ex } = e
    const { formatter_format, formatter_option, terminal_data } = LAYOUT
    const view = e.view()
    const format = e.alloc(U32_SIZE)
    view.setUint32(format, formatter_format.PLAIN, true)
    const trim = e.alloc(1)
    e.bytes()[trim] = 0
    const selection = e.alloc(LAYOUT.selection.size)
    const has_selection = ex.ghostty_terminal_get(
      this.handle,
      terminal_data.SELECTION,
      selection
    )
    const formatter_slot = e.alloc_opaque()
    let result = ex.ghostty_formatter_terminal_new(
      0,
      formatter_slot,
      this.handle
    )
    if (result !== SUCCESS)
      throw new Error(`ghostty_formatter_terminal_new: ${result}`)
    const formatter = e.take_opaque(formatter_slot)
    ex.ghostty_formatter_set(formatter, formatter_option.EMIT, format)
    ex.ghostty_formatter_set(formatter, formatter_option.TRIM, trim)
    if (has_selection === SUCCESS)
      ex.ghostty_formatter_set(formatter, formatter_option.SELECTION, selection)
    const out_ptr = e.alloc(U32_SIZE)
    const out_len = e.alloc(U32_SIZE)
    result = ex.ghostty_formatter_format_alloc(formatter, 0, out_ptr, out_len)
    let text = ''
    if (result === SUCCESS) {
      const ptr = e.read_u32(out_ptr)
      const len = e.read_u32(out_len)
      if (ptr && len)
        text = new TextDecoder().decode(e.bytes().slice(ptr, ptr + len))
      ex.ghostty_free(0, ptr, len)
    }
    ex.ghostty_formatter_free(formatter)
    e.free_opaque(formatter_slot)
    e.free(format, U32_SIZE)
    e.free(trim, 1)
    e.free(selection, LAYOUT.selection.size)
    e.free(out_ptr, U32_SIZE)
    e.free(out_len, U32_SIZE)
    return text
  }

  /** Scroll the viewport by `delta` rows (negative up, positive down). */
  scroll(delta) {
    this.#scroll_viewport(SCROLL.DELTA, delta)
  }

  scroll_to_bottom() {
    this.#scroll_viewport(SCROLL.BOTTOM, 0)
  }

  scroll_to_top() {
    this.#scroll_viewport(SCROLL.TOP, 0)
  }

  /** Erase retained history, keeping the visible screen. */
  clear_scrollback() {
    const U32_SIZE = 4
    const e = this.engine
    const zero = e.alloc(U32_SIZE)
    e.view().setUint32(zero, 0, true)
    const result = e.ex.ghostty_terminal_set(
      this.handle,
      LAYOUT.terminal_option.SCROLLBACK_MAX_BYTES,
      zero
    )
    e.ex.ghostty_terminal_set(
      this.handle,
      LAYOUT.terminal_option.SCROLLBACK_MAX_BYTES,
      0
    )
    e.free(zero, U32_SIZE)
    if (result !== SUCCESS) throw new Error(`clear_scrollback: ${result}`)
  }

  /** True while the app asked for mouse reports, e.g. Pi's fullscreen TUI. */
  mouse_tracking() {
    const e = this.engine
    const ptr = e.alloc(1)
    const result = e.ex.ghostty_terminal_get(
      this.handle,
      LAYOUT.terminal_data.MOUSE_TRACKING,
      ptr
    )
    const on = result === SUCCESS && e.view().getUint8(ptr) !== 0
    e.free(ptr, 1)
    return on
  }

  /** {total, offset, len} in rows, or null. */
  scrollbar() {
    const e = this.engine
    const { terminal_scrollbar: bar_size, terminal_data } = LAYOUT
    const ptr = e.alloc(bar_size.size)
    const result = e.ex.ghostty_terminal_get(
      this.handle,
      terminal_data.SCROLLBAR,
      ptr
    )
    if (result !== SUCCESS) {
      e.free(ptr, bar_size.size)
      return null
    }
    const view = e.view()
    const bar = {
      total: Number(view.getBigUint64(ptr + bar_size.total, true)),
      offset: Number(view.getBigUint64(ptr + bar_size.offset, true)),
      len: Number(view.getBigUint64(ptr + bar_size.len, true))
    }
    e.free(ptr, bar_size.size)
    return bar
  }

  #grid_ref(x, y) {
    const e = this.engine
    const { point, grid_ref: ref_size, point_tag } = LAYOUT
    const ptr = e.alloc(point.size)
    const view = e.view()
    view.setUint32(ptr + point.tag, point_tag.VIEWPORT, true)
    view.setUint16(ptr + point.x, x, true)
    view.setUint32(ptr + point.y, y, true)
    const ref = e.alloc(ref_size.size)
    const result = e.ex.ghostty_terminal_grid_ref(this.handle, ptr, ref)
    e.free(ptr, point.size)
    if (result !== SUCCESS) {
      e.free(ref, ref_size.size)
      throw new Error(`grid_ref(${x},${y}): ${result}`)
    }
    return ref
  }

  #scroll_viewport(tag, delta) {
    const behavior = LAYOUT.terminal_scroll_viewport
    const e = this.engine
    const ptr = e.alloc(behavior.size)
    const view = e.view()
    view.setUint32(ptr + behavior.tag, tag, true)
    view.setInt32(ptr + behavior.delta, delta, true)
    e.ex.ghostty_terminal_scroll_viewport(this.handle, ptr)
    e.free(ptr, behavior.size)
  }

  #read_state_u32(state, data) {
    const U32_SIZE = 4
    const e = this.engine
    const ptr = e.alloc(U32_SIZE)
    const result = e.ex.ghostty_render_state_get(state, data, ptr)
    const value = result === SUCCESS ? e.read_u32(ptr) : 0
    e.free(ptr, U32_SIZE)
    return value
  }

  #read_colors(state) {
    const PALETTE_LENGTH = 256
    const colors_size = LAYOUT.render_state_colors
    const e = this.engine
    const { ex } = e
    const ptr = e.alloc(colors_size.size)
    e.view().setUint32(ptr, colors_size.size, true)
    const result = ex.ghostty_render_state_get(state, DATA.COLORS, ptr)
    if (result !== SUCCESS) throw new Error(`render colors: ${result}`)
    const view = e.view()
    const read_rgb = off => [
      view.getUint8(off),
      view.getUint8(off + 1),
      view.getUint8(off + 2)
    ]
    const colors = {
      background: read_rgb(ptr + colors_size.background),
      foreground: read_rgb(ptr + colors_size.foreground),
      cursor: read_rgb(ptr + colors_size.cursor),
      palette: Array.from({ length: PALETTE_LENGTH }, (_, i) =>
        read_rgb(ptr + colors_size.palette + i * 3)
      )
    }
    e.free(ptr, colors_size.size)
    return colors
  }

  #read_cursor(state) {
    const cursor_size = LAYOUT.render_state_cursor
    const e = this.engine
    const { ex } = e
    const ptr = e.alloc(cursor_size.size)
    e.view().setUint32(ptr, cursor_size.size, true)
    const result = ex.ghostty_render_state_get(state, DATA.CURSOR, ptr)
    if (result !== SUCCESS) throw new Error(`render cursor: ${result}`)
    const view = e.view()
    const cursor = {
      visible: view.getUint8(ptr + cursor_size.visible) !== 0,
      blinking: view.getUint8(ptr + cursor_size.blinking) !== 0,
      viewport_has_value:
        view.getUint8(ptr + cursor_size.viewport_has_value) !== 0,
      x: view.getUint16(ptr + cursor_size.viewport_x, true),
      y: view.getUint16(ptr + cursor_size.viewport_y, true),
      visual_style: view.getUint32(ptr + cursor_size.visual_style, true)
    }
    e.free(ptr, cursor_size.size)
    return cursor
  }

  #read_row_selection(iterator, ptr) {
    const selection = LAYOUT.render_state_row_selection
    const e = this.engine
    e.view().setUint32(ptr, selection.size, true)
    const result = e.ex.ghostty_render_state_row_get(
      iterator,
      ROW_DATA.SELECTION,
      ptr
    )
    if (result !== SUCCESS) return null
    const view = e.view()
    return {
      start_x: view.getUint16(ptr + selection.start_x, true),
      end_x: view.getUint16(ptr + selection.end_x, true)
    }
  }

  #read_row_dirty(iterator, data) {
    const e = this.engine
    const ptr = e.alloc(1)
    const result = e.ex.ghostty_render_state_row_get(iterator, data, ptr)
    const value = result === SUCCESS ? e.bytes()[ptr] : 0
    e.free(ptr, 1)
    return value
  }

  #read_graphemes(cells, buffer_ptr, text_ptr) {
    const { buffer } = LAYOUT
    const TEXT_BUFFER_SIZE = 256
    const e = this.engine
    const { ex } = e
    const view = e.view()
    view.setUint32(buffer_ptr + buffer.ptr, text_ptr, true)
    view.setUint32(buffer_ptr + buffer.cap, TEXT_BUFFER_SIZE, true)
    view.setUint32(buffer_ptr + buffer.len, 0, true)
    let result = ex.ghostty_render_state_row_cells_get(
      cells,
      CELL_DATA.GRAPHEMES_UTF8,
      buffer_ptr
    )
    if (result === OUT_OF_SPACE) {
      const needed = e.view().getUint32(buffer_ptr + buffer.len, true)
      if (needed === 0) return ''
      const big = e.alloc(needed)
      view.setUint32(buffer_ptr + buffer.ptr, big, true)
      view.setUint32(buffer_ptr + buffer.cap, needed, true)
      result = ex.ghostty_render_state_row_cells_get(
        cells,
        CELL_DATA.GRAPHEMES_UTF8,
        buffer_ptr
      )
      const len = e.view().getUint32(buffer_ptr + buffer.len, true)
      const text = new TextDecoder().decode(e.bytes().slice(big, big + len))
      e.free(big, needed)
      return text
    }
    if (result !== SUCCESS) return ''
    const len = e.view().getUint32(buffer_ptr + buffer.len, true)
    if (len === 0) return ''
    return new TextDecoder().decode(e.bytes().slice(text_ptr, text_ptr + len))
  }

  /** @returns {number[]|null} resolved rgb, or null when the cell has none */
  #read_color(cells, data) {
    const e = this.engine
    const ptr = e.alloc(3)
    const result = e.ex.ghostty_render_state_row_cells_get(cells, data, ptr)
    if (result !== SUCCESS) {
      e.free(ptr, 3)
      return null
    }
    const view = e.view()
    const rgb = [
      view.getUint8(ptr),
      view.getUint8(ptr + 1),
      view.getUint8(ptr + 2)
    ]
    e.free(ptr, 3)
    return rgb
  }

  #read_bool(cells, data) {
    const e = this.engine
    const ptr = e.alloc(1)
    const result = e.ex.ghostty_render_state_row_cells_get(cells, data, ptr)
    const value = result === SUCCESS ? e.bytes()[ptr] : 0
    e.free(ptr, 1)
    return value !== 0
  }

  #read_flags(style_ptr) {
    const { style, style_flags: bits } = LAYOUT
    const flags = this.engine.view().getUint16(style_ptr + style.flags, true)
    const has = bit => (flags & (1 << bit)) !== 0
    const underline_mask = (1 << bits.underline_width) - 1
    return {
      fg_color: this.#read_style_color(style_ptr + style.fg_color),
      bg_color: this.#read_style_color(style_ptr + style.bg_color),
      bold: has(bits.bold),
      italic: has(bits.italic),
      faint: has(bits.faint),
      blink: has(bits.blink),
      inverse: has(bits.inverse),
      invisible: has(bits.invisible),
      strikethrough: has(bits.strikethrough),
      overline: has(bits.overline),
      underline: (flags >> bits.underline) & underline_mask
    }
  }

  #read_style_color(ptr) {
    const { style_color: color, style_color_tag: tag_names } = LAYOUT
    const view = this.engine.view()
    const tag = view.getUint8(ptr + color.tag)
    if (tag === tag_names.RGB)
      return [
        view.getUint8(ptr + color.rgb),
        view.getUint8(ptr + color.rgb + 1),
        view.getUint8(ptr + color.rgb + 2)
      ]

    if (tag === tag_names.PALETTE)
      return { palette: view.getUint8(ptr + color.palette) }
    return null
  }
}
