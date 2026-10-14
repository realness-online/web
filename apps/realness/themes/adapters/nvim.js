const slots = ["background", "raised", "selection", "syntax-comment", "syntax-secondary-text", "text", "syntax-strong-text", "syntax-bright-text", "error", "syntax-number", "warning", "syntax-string", "syntax-cyan", "working", "syntax-keyword", "syntax-special"]

/** mini.base16 roles, selected by nvim's background option. */
export const nvim = (name, schemes) => {
  const table = scheme => slots.map((role, index) => `    base${index.toString(16).toUpperCase().padStart(2, "0")} = "${schemes[scheme].roles[role]}",`).join("\n")
  return `local palettes = {
  dark = {
${table("dark")}
  },
  light = {
${table("light")}
  },
}

require("mini.base16").setup({ palette = palettes[vim.o.background] or palettes.dark, use_cterm = true })
vim.g.colors_name = "${name}"
`
}
