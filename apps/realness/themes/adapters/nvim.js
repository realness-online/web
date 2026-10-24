const slots = ["background", "raised", "selection", "syntax-comment", "syntax-secondary-text", "text", "syntax-strong-text", "syntax-bright-text", "error", "syntax-number", "warning", "syntax-string", "syntax-cyan", "working", "syntax-keyword", "syntax-special"]

const groups = [
  ["@variable", "text"],
  ["@variable.parameter", "error"],
  ["@variable.member", "error"],
  ["@property", "error"],
  ["@variable.builtin", "syntax-cyan"],
  ["@function.builtin", "syntax-cyan"],
  ["@constant.builtin", "syntax-number"],
  ["@string.escape", "syntax-cyan"],
  ["@string.regexp", "syntax-cyan"],
  ["@operator", "syntax-secondary-text"],
  ["@punctuation", "syntax-secondary-text"],
  ["@punctuation.bracket", "syntax-secondary-text"],
  ["@punctuation.delimiter", "syntax-secondary-text"],
  ["@punctuation.special", "syntax-secondary-text"],
  ["@tag", "error"],
  ["@tag.attribute", "syntax-number"],
  ["@tag.delimiter", "syntax-secondary-text"],
  ["@comment.documentation", "syntax-comment"],
  ["@keyword.directive", "syntax-keyword"],
  ["@lsp.type.parameter", "error"],
  ["@lsp.type.property", "error"],
  ["@lsp.typemod.variable.declaration", "error"],
  ["@lsp.typemod.function.defaultLibrary", "syntax-cyan"],
  ["@lsp.typemod.variable.defaultLibrary", "syntax-cyan"]
]

/** mini.base16 roles, selected by nvim's background option, plus tree-sitter and LSP groups that match the Emacs theme. */
export const nvim = (name, schemes) => {
  const table = scheme => slots.map((role, index) => `    base${index.toString(16).toUpperCase().padStart(2, "0")} = "${schemes[scheme].roles[role]}",`).join("\n")
  const syntax = scheme => groups.map(([group, role]) => `    ["${group}"] = "${schemes[scheme].roles[role]}",`).join("\n")
  return `local palettes = {
  dark = {
${table("dark")}
  },
  light = {
${table("light")}
  },
}

require("mini.base16").setup({ palette = palettes[vim.o.background] or palettes.dark, use_cterm = true })
local syntax = {
  dark = {
${syntax("dark")}
  },
  light = {
${syntax("light")}
  },
}

for group, color in pairs(syntax[vim.o.background] or syntax.dark) do
  vim.api.nvim_set_hl(0, group, { fg = color })
end

vim.g.colors_name = "${name}"
`
}
