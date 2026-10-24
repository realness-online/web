---
name: editor
description: See what the user has open in their editor - Neovim or Emacs - and open files in it. Reads the open buffers, cursor, and visible lines so you can discuss their actual working files, and teaches their own nvim or Emacs keys in context. Use when the user mentions Emacs, Neovim, vim, or their editor, asks "talk about what I have open", mentions a file they're working on without naming it, asks "how do I do X" in their editor, or wants a file opened.
metadata:
  check: "node ../../bin/checks/check-skills.js editor"
---

# Nvim Buffers

The user runs LazyVim (`~/.config/nvim`, config in `work/nvim`). An autocmd in
`lua/config/autocmds.lua` writes the open real-file buffers to a state file on
every buffer change. Read that file with the `read` tool (or `cat`) to see what
they're working on.

## Path

`~/.local/state/nvim/open-buffers.json` (`vim.fn.stdpath("state")` on macOS)

## Shape

```json
{
  "current": "/abs/path/to/current/buffer",
  "buffers": ["/abs/path/a", "/abs/path/b"],
  "scratch": [{ "bufnr": 3, "lines": 1, "text": "pasted text" }],
  "oil": [{ "dir": "/browsed/dir", "highlighted": "file.lua" }],
  "view": {
    "file": "/abs/path",
    "line": 42,
    "col": 3,
    "visible": { "from_top": 30, "to_bottom": 60 },
    "context": ["line 40", "line 41", "line 42"]
  },
  "updated": "2026-08-11T14:01:00"
}
```

- `current` - the active buffer; null or an oil dir if the active buffer is a
  terminal/oil/unnamed buffer.
- `buffers` - sorted list of all listed real-file buffers (term://, oil://,
  unnamed excluded).
- `scratch` - unsaved text: unnamed buffers and modified files, with their
  `text`, `lines`, `bufnr`, and `name`/`filetype` when set. Only normal buffers
  (`buftype` ""); dashboards and popups are skipped. `capped: true` and no
  `text` past 64 KB per buffer or 200 KB total.
- `oil` - directories currently browsed in oil (strips the `oil://` prefix),
  each with `highlighted` - the entry name under the cursor in that oil
  window, or null if the oil buffer isn't shown in a window right now.
- `view` - the active window: file, cursor line/col, visible top/bottom lines,
  and a few lines of `context` around the cursor. Use this to answer "what's on
  my screen" / "what am I looking at" / "what should I press here".
- `updated` - when nvim last wrote it. Check it's fresh before trusting it.

Freshness: refreshed on buffer events, `FocusGained`, `TextChanged`,
`InsertLeave`, and a 5s timer that writes only while a buffer is unsaved.
Text typed in insert mode appears after `Esc`.

## Coaching role (training wheels)

The user is still learning vim and runs hardtime.nvim, which blocks/"yells" at
inefficient keys. Be the patient counterpart:

- When they ask how to do something, teach from THEIR config (`work/nvim/`,
  `lua/config/keymaps.lua`, `lua/plugins/*.lua`), never generic defaults.
- One key at a time, tied to what their `view` shows.
- Read the state file first and confirm what they're looking at before
  answering, so hints land on their real cursor position.
- Their notable bindings: `-` = Oil parent dir, `<leader>gg`/`<leader>gG` =
  gitui, `gr` = LSP references, `<leader>fb` = buffers (Snacks), `<leader>fg` =
  grep, `gd`/`gi` = LSP definition/implementation, `K` = hover. Git + search are
  LazyVim defaults (`<leader>g...`, `<leader>f...`).

## Paste to save

The user's workflow: `:enew`, paste, then name a path. Read `scratch[].text`
and write it with the `write` tool. If several scratch entries exist, confirm
which one. If `capped`, ask the user to save the buffer with `:w <path>`.

## How to use

- When the user mentions files "open in nvim", read this file first and confirm
  which files you're looking at before going deep - the user shouldn't have to
  name paths they already have in front of them.
- If the file is missing or stale (no update in a while), nvim may be closed or
  the autocmd may not have run; say so plainly instead of guessing.
- The write happens on `VimEnter`/`BufAdd`/`BufEnter`/`BufDelete`/`BufWipeout`/
  `VimLeavePre`/`FocusGained`/`TextChanged`/`InsertLeave`.
  If the user just opened/closed a buffer and the file looks stale, they may
  need nvim to pick up the change (or nvim config may need a reload).

## Emacs

Doom Emacs (`~/.config/doom` -> `work/doom`, vim keys off) loads
`buffers.el`, which writes the same shape to
`~/.local/state/emacs/open-buffers.json`. Differences: `dired` replaces `oil`,
`bufnr` is the buffer name, and `filetype` is the major mode. It writes 0.5s
after Emacs goes idle following any command, edit, save, or focus change.
When both state files exist, trust the one with the newer `updated`.

To open a file in the user's Emacs:
`emacsclient -s ~/.local/state/emacs/server/server -n /abs/path` (add `+LINE`
before the path to jump to a line). The server starts with Emacs; the fixed
socket path matters because the agent's `TMPDIR` differs from the user's.
Coach with Emacs keys, not vim keys: leader is `M-SPC` (or `ESC SPC` in the
terminal), `C-g` cancels.

## Local quirks

- Remote nvim commands need `redraw!`.
