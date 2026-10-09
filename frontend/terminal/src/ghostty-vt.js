// Thin snake_case wrapper over the libghostty-vt wasm module.
// Struct layouts and enum values come from ghostty_type_json (ghostty-types.json).
// Loads in Node and in the browser.

const SUCCESS = 0
const NO_VALUE = -4
const OUT_OF_SPACE = -3

// GhosttyRenderStateData
const DATA_ROW_ITERATOR = 4
const DATA_CURSOR = 18
const DATA_COLORS = 19
const DATA = {
  COLS: 1,
  ROWS: 2,
  DIRTY: 3,
  ROW_ITERATOR: DATA_ROW_ITERATOR,
  CURSOR: DATA_CURSOR,
  COLORS: DATA_COLORS
}
// GhosttyRenderStateRowData
const ROW_DATA_SELECTION = 4
const ROW_DATA = { DIRTY: 1, CELLS: 3, SELECTION: ROW_DATA_SELECTION }
// GhosttyRenderStateRowCellsData
const CELL_DATA_FG_COLOR = 6
const CELL_DATA_SELECTED = 7
const CELL_DATA_GRAPHEMES_UTF8 = 9
const CELL_DATA = {
  STYLE: 2,
  FG_COLOR: CELL_DATA_FG_COLOR,
  BG_COLOR: 5,
  SELECTED: CELL_DATA_SELECTED,
  GRAPHEMES_UTF8: CELL_DATA_GRAPHEMES_UTF8
}
// GhosttyStyleColorTag
const COLOR_TAG = { NONE: 0, PALETTE: 1, RGB: 2 }
// Terminal options and data kinds.
const OPT_SELECTION = 21
const OPT_SCROLLBACK_MAX_BYTES = 27
const OPT_COLOR_FOREGROUND = 11
const OPT_COLOR_BACKGROUND = 12
const OPT_COLOR_CURSOR = 13
const OPT_COLOR_PALETTE = 14
const DATA_SCROLLBAR = 9
const DATA_MOUSE_TRACKING = 11
// GhosttyTerminalScrollViewportTag
const SCROLL = { TOP: 0, BOTTOM: 1, DELTA: 2, ROW: 3 }
// GhosttyFormatterFormat
const FORMAT_PLAIN = 0
// GhosttyPointTag
const POINT_VIEWPORT = 1

// Struct sizes, from ghostty-types.json.
const STYLE_SIZE = 72
const COLORS_SIZE = 784
const CURSOR_SIZE = 20
const ROW_SELECTION_SIZE = 8
const BUFFER_SIZE = 12
const DEFAULT_CELL_HEIGHT = 16

// GhosttyKeyAction
const KEY_ACTION = { RELEASE: 0, PRESS: 1, REPEAT: 2 }
// GhosttyKey values used by the page.
const KEY_ESCAPE = 120
const KEY_ENTER = 58
const KEY_TAB = 64
const KEY_BACKSPACE = 53
const KEY_ARROW_UP = 78
const KEY_ARROW_DOWN = 75
const KEY_ARROW_LEFT = 76
const KEY_ARROW_RIGHT = 77
const KEY_HOME = 71
const KEY_END = 69
const KEY_PAGE_UP = 74
const KEY_PAGE_DOWN = 73
const KEY_DELETE = 68
const KEY_SPACE = 63
export const KEY = {
  ESCAPE: KEY_ESCAPE,
  ENTER: KEY_ENTER,
  TAB: KEY_TAB,
  BACKSPACE: KEY_BACKSPACE,
  ARROW_UP: KEY_ARROW_UP,
  ARROW_DOWN: KEY_ARROW_DOWN,
  ARROW_LEFT: KEY_ARROW_LEFT,
  ARROW_RIGHT: KEY_ARROW_RIGHT,
  HOME: KEY_HOME,
  END: KEY_END,
  PAGE_UP: KEY_PAGE_UP,
  PAGE_DOWN: KEY_PAGE_DOWN,
  DELETE: KEY_DELETE,
  SPACE: KEY_SPACE
}

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
  set_rgb(OPT_COLOR_FOREGROUND, theme.foreground)
  set_rgb(OPT_COLOR_BACKGROUND, theme.background)
  set_rgb(OPT_COLOR_CURSOR, theme.cursor)

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
    OPT_COLOR_PALETTE,
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
  const { instance } = await WebAssembly.instantiate(bytes, {
    env: { log: () => {} }
  })
  return new Engine(instance.exports)
}

const to_bytes = async source => {
  if (source instanceof Uint8Array || source instanceof ArrayBuffer)
    return source
  const is_node =
    typeof process !== 'undefined' && process.versions && process.versions.node
  if (is_node) {
    const { readFile } = await import('node:fs/promises')
    return readFile(source)
  }
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

export class Encoder {
  constructor(engine, handle) {
    this.engine = engine
    this.handle = handle
  }

  set_from_terminal(terminal) {
    this.engine.ex.ghostty_key_encoder_setopt_from_terminal(
      this.handle,
      terminal.handle
    )
  }

  set_option(option, value) {
    const e = this.engine
    const ptr = e.alloc(1)
    e.bytes()[ptr] = value
    e.ex.ghostty_key_encoder_setopt(this.handle, option, ptr)
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

    ex.ghostty_key_event_set_action(handle, event.action ?? KEY_ACTION.PRESS)
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

export class Terminal {
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
    const buffer_ptr = e.alloc(BUFFER_SIZE)
    const style_ptr = e.alloc(STYLE_SIZE)
    const selection_ptr = e.alloc(ROW_SELECTION_SIZE)

    const rows_data = []
    while (ex.ghostty_render_state_row_iterator_next(iterator)) {
      // row_get expects the out pointer to hold the reusable cells handle.
      e.view().setUint32(cells_slot, cells, true)
      result = ex.ghostty_render_state_row_get(
        iterator,
        ROW_DATA.CELLS,
        cells_slot
      )
      if (result !== SUCCESS) throw new Error(`row cells get: ${result}`)

      // Re-read the handle: the row get may hand back a bound cells handle.
      const row_cells = e.read_u32(cells_slot) || cells

      const selection = this.#read_row_selection(iterator, selection_ptr)

      const row_cells_data = []
      while (ex.ghostty_render_state_row_cells_next(row_cells)) {
        const text = this.#read_graphemes(row_cells, buffer_ptr, text_ptr)
        const fg = this.#read_color(row_cells, CELL_DATA.FG_COLOR)
        const bg = this.#read_color(row_cells, CELL_DATA.BG_COLOR)
        const selected = this.#read_bool(row_cells, CELL_DATA.SELECTED)

        e.view().setUint32(style_ptr, STYLE_SIZE, true) // size
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
    e.free(buffer_ptr, BUFFER_SIZE)
    e.free(style_ptr, STYLE_SIZE)
    e.free(selection_ptr, ROW_SELECTION_SIZE)
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
    const SELECTION_SIZE = 32
    const START_OFFSET = 4
    const END_OFFSET = 16
    const RECTANGULAR_OFFSET = 28
    const GRID_REF_SIZE = 12
    const e = this.engine
    const start = this.#grid_ref(x1, y1)
    const end = this.#grid_ref(x2, y2)
    const sel = e.alloc(SELECTION_SIZE)
    e.view().setUint32(sel, SELECTION_SIZE, true)
    e.bytes().copyWithin(sel + START_OFFSET, start, start + GRID_REF_SIZE)
    e.bytes().copyWithin(sel + END_OFFSET, end, end + GRID_REF_SIZE)
    e.bytes()[sel + RECTANGULAR_OFFSET] = 0
    const result = e.ex.ghostty_terminal_set(this.handle, OPT_SELECTION, sel)
    e.free(start, GRID_REF_SIZE)
    e.free(end, GRID_REF_SIZE)
    e.free(sel, SELECTION_SIZE)
    if (result !== SUCCESS) throw new Error(`set selection: ${result}`)
  }

  select_all() {
    const SELECTION_SIZE = 32
    const e = this.engine
    const sel = e.alloc(SELECTION_SIZE)
    e.view().setUint32(sel, SELECTION_SIZE, true)
    const result = e.ex.ghostty_terminal_select_all(this.handle, sel)
    if (result === NO_VALUE) {
      e.free(sel, SELECTION_SIZE)
      return false
    }
    if (result !== SUCCESS) {
      e.free(sel, SELECTION_SIZE)
      throw new Error(`select_all: ${result}`)
    }
    const set = e.ex.ghostty_terminal_set(this.handle, OPT_SELECTION, sel)
    e.free(sel, SELECTION_SIZE)
    if (set !== SUCCESS) throw new Error(`set selection: ${set}`)
    return true
  }

  /** The active selection as plain text, or "" when there is none. */
  selection_text() {
    const OPTIONS_SIZE = 16
    const FORMAT_OFFSET = 4
    const TRIM_OFFSET = 9
    const FLAGS_OFFSET = 12
    const U32_SIZE = 4
    const e = this.engine
    const options = e.alloc(OPTIONS_SIZE)
    const view = e.view()
    view.setUint32(options, OPTIONS_SIZE, true)
    view.setUint32(options + FORMAT_OFFSET, FORMAT_PLAIN, true)
    view.setUint8(options + 8, 0)
    view.setUint8(options + TRIM_OFFSET, 0)
    view.setUint32(options + FLAGS_OFFSET, 0, true)
    const out_ptr = e.alloc(U32_SIZE)
    const out_len = e.alloc(U32_SIZE)
    const result = e.ex.ghostty_terminal_selection_format_alloc(
      this.handle,
      0,
      options,
      out_ptr,
      out_len
    )
    let text = ''
    if (result === SUCCESS) {
      const ptr = e.read_u32(out_ptr)
      const len = e.read_u32(out_len)
      if (ptr && len)
        text = new TextDecoder().decode(e.bytes().slice(ptr, ptr + len))
      e.ex.ghostty_free(0, ptr, len)
    }
    e.free(options, OPTIONS_SIZE)
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
      OPT_SCROLLBACK_MAX_BYTES,
      zero
    )
    // NULL removes the byte limit so scrollback keeps working.
    e.ex.ghostty_terminal_set(this.handle, OPT_SCROLLBACK_MAX_BYTES, 0)
    e.free(zero, U32_SIZE)
    if (result !== SUCCESS) throw new Error(`clear_scrollback: ${result}`)
  }

  /** True while the app asked for mouse reports, e.g. Pi's fullscreen TUI. */
  mouse_tracking() {
    const e = this.engine
    const ptr = e.alloc(1)
    const result = e.ex.ghostty_terminal_get(
      this.handle,
      DATA_MOUSE_TRACKING,
      ptr
    )
    const on = result === SUCCESS && e.view().getUint8(ptr) !== 0
    e.free(ptr, 1)
    return on
  }

  /** {total, offset, len} in rows, or null. */
  scrollbar() {
    const SCROLLBAR_SIZE = 24
    const LENGTH_OFFSET = 16
    const e = this.engine
    const ptr = e.alloc(SCROLLBAR_SIZE)
    const result = e.ex.ghostty_terminal_get(this.handle, DATA_SCROLLBAR, ptr)
    if (result !== SUCCESS) {
      e.free(ptr, SCROLLBAR_SIZE)
      return null
    }
    const view = e.view()
    const bar = {
      total: Number(view.getBigUint64(ptr, true)),
      offset: Number(view.getBigUint64(ptr + 8, true)),
      len: Number(view.getBigUint64(ptr + LENGTH_OFFSET, true))
    }
    e.free(ptr, SCROLLBAR_SIZE)
    return bar
  }

  #grid_ref(x, y) {
    const POINT_SIZE = 24
    const TAG_OFFSET = 4
    const Y_OFFSET = 12
    const GRID_REF_SIZE = 12
    const e = this.engine
    const point = e.alloc(POINT_SIZE)
    const view = e.view()
    view.setUint32(point, POINT_SIZE, true)
    view.setUint32(point + TAG_OFFSET, POINT_VIEWPORT, true)
    view.setUint16(point + 8, x, true)
    view.setUint32(point + Y_OFFSET, y, true)
    const ref = e.alloc(GRID_REF_SIZE)
    view.setUint32(ref, GRID_REF_SIZE, true)
    const result = e.ex.ghostty_terminal_grid_ref(this.handle, point, ref)
    e.free(point, POINT_SIZE)
    if (result !== SUCCESS) {
      e.free(ref, GRID_REF_SIZE)
      throw new Error(`grid_ref(${x},${y}): ${result}`)
    }
    return ref
  }

  #scroll_viewport(tag, delta) {
    const SCROLL_SIZE = 24
    const e = this.engine
    const behavior = e.alloc(SCROLL_SIZE)
    const view = e.view()
    view.setUint32(behavior, tag, true)
    view.setInt32(behavior + 8, delta, true)
    e.ex.ghostty_terminal_scroll_viewport(this.handle, behavior)
    e.free(behavior, SCROLL_SIZE)
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
    const BACKGROUND_OFFSET = 4
    const FOREGROUND_OFFSET = 7
    const CURSOR_OFFSET = 10
    const PALETTE_OFFSET = 14
    const PALETTE_LENGTH = 256
    const e = this.engine
    const { ex } = e
    const ptr = e.alloc(COLORS_SIZE)
    e.view().setUint32(ptr, COLORS_SIZE, true)
    const result = ex.ghostty_render_state_get(state, DATA.COLORS, ptr)
    if (result !== SUCCESS) throw new Error(`render colors: ${result}`)
    const view = e.view()
    const read_rgb = off => [
      view.getUint8(off),
      view.getUint8(off + 1),
      view.getUint8(off + 2)
    ]
    const colors = {
      background: read_rgb(ptr + BACKGROUND_OFFSET),
      foreground: read_rgb(ptr + FOREGROUND_OFFSET),
      cursor: read_rgb(ptr + CURSOR_OFFSET),
      palette: Array.from({ length: PALETTE_LENGTH }, (_, i) =>
        read_rgb(ptr + PALETTE_OFFSET + i * 3)
      )
    }
    e.free(ptr, COLORS_SIZE)
    return colors
  }

  #read_cursor(state) {
    const VISIBLE_OFFSET = 11
    const BLINKING_OFFSET = 12
    const VIEWPORT_OFFSET = 4
    const X_OFFSET = 6
    const STYLE_OFFSET = 16
    const e = this.engine
    const { ex } = e
    const ptr = e.alloc(CURSOR_SIZE)
    e.view().setUint32(ptr, CURSOR_SIZE, true)
    const result = ex.ghostty_render_state_get(state, DATA.CURSOR, ptr)
    if (result !== SUCCESS) throw new Error(`render cursor: ${result}`)
    const view = e.view()
    const cursor = {
      visible: view.getUint8(ptr + VISIBLE_OFFSET) !== 0,
      blinking: view.getUint8(ptr + BLINKING_OFFSET) !== 0,
      viewport_has_value: view.getUint8(ptr + VIEWPORT_OFFSET) !== 0,
      x: view.getUint16(ptr + X_OFFSET, true),
      y: view.getUint16(ptr + 8, true),
      visual_style: view.getUint32(ptr + STYLE_OFFSET, true)
    }
    e.free(ptr, CURSOR_SIZE)
    return cursor
  }

  #read_row_selection(iterator, ptr) {
    const START_OFFSET = 4
    const END_OFFSET = 6
    const e = this.engine
    e.view().setUint32(ptr, ROW_SELECTION_SIZE, true)
    const result = e.ex.ghostty_render_state_row_get(
      iterator,
      ROW_DATA.SELECTION,
      ptr
    )
    if (result !== SUCCESS) return null
    const view = e.view()
    return {
      start_x: view.getUint16(ptr + START_OFFSET, true),
      end_x: view.getUint16(ptr + END_OFFSET, true)
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
    const CAPACITY_OFFSET = 4
    const TEXT_BUFFER_SIZE = 256
    const e = this.engine
    const { ex } = e
    const view = e.view()
    view.setUint32(buffer_ptr, text_ptr, true)
    view.setUint32(buffer_ptr + CAPACITY_OFFSET, TEXT_BUFFER_SIZE, true)
    view.setUint32(buffer_ptr + 8, 0, true)
    let result = ex.ghostty_render_state_row_cells_get(
      cells,
      CELL_DATA.GRAPHEMES_UTF8,
      buffer_ptr
    )
    if (result === OUT_OF_SPACE) {
      const needed = e.view().getUint32(buffer_ptr + 8, true)
      if (needed === 0) return ''
      const big = e.alloc(needed)
      view.setUint32(buffer_ptr, big, true)
      view.setUint32(buffer_ptr + CAPACITY_OFFSET, needed, true)
      result = ex.ghostty_render_state_row_cells_get(
        cells,
        CELL_DATA.GRAPHEMES_UTF8,
        buffer_ptr
      )
      const len = e.view().getUint32(buffer_ptr + 8, true)
      const text = new TextDecoder().decode(e.bytes().slice(big, big + len))
      e.free(big, needed)
      return text
    }
    if (result !== SUCCESS) return ''
    const len = e.view().getUint32(buffer_ptr + 8, true)
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
    const BG_OFFSET = 24
    const BOLD_OFFSET = 56
    const ITALIC_OFFSET = 57
    const FAINT_OFFSET = 58
    const BLINK_OFFSET = 59
    const INVISIBLE_OFFSET = 61
    const STRIKETHROUGH_OFFSET = 62
    const OVERLINE_OFFSET = 63
    const UNDERLINE_OFFSET = 64
    const b = this.engine.bytes()
    const fg = this.#read_style_color(style_ptr + 8)
    const bg = this.#read_style_color(style_ptr + BG_OFFSET)
    return {
      fg_color: fg,
      bg_color: bg,
      bold: b[style_ptr + BOLD_OFFSET] !== 0,
      italic: b[style_ptr + ITALIC_OFFSET] !== 0,
      faint: b[style_ptr + FAINT_OFFSET] !== 0,
      blink: b[style_ptr + BLINK_OFFSET] !== 0,
      inverse: b[style_ptr + 60] !== 0,
      invisible: b[style_ptr + INVISIBLE_OFFSET] !== 0,
      strikethrough: b[style_ptr + STRIKETHROUGH_OFFSET] !== 0,
      overline: b[style_ptr + OVERLINE_OFFSET] !== 0,
      underline: this.engine.view().getInt32(style_ptr + UNDERLINE_OFFSET, true)
    }
  }

  #read_style_color(ptr) {
    const GREEN_OFFSET = 9
    const BLUE_OFFSET = 10
    const view = this.engine.view()
    const tag = view.getUint32(ptr, true)
    if (tag === COLOR_TAG.RGB)
      return [
        view.getUint8(ptr + 8),
        view.getUint8(ptr + GREEN_OFFSET),
        view.getUint8(ptr + BLUE_OFFSET)
      ]

    if (tag === COLOR_TAG.PALETTE) return { palette: view.getUint8(ptr + 8) }
    return null
  }
}
