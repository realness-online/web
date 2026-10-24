const web_roles = {
  warning: "warning", accent: "accent", emphasis: "error", working: "working",
  "surface-glass": "surface-glass", text: "document-text", surface: "surface", background: "background",
  "code-surface": "code-surface", "muted-text": "muted-text", contrast: "contrast",
}

/** Keep material references in CSS so alpha and browser color mixing survive. */
export const web = ({ light, dark }) => {
  const block = theme => Object.entries(web_roles).map(([property, role]) => `  --${property}: ${theme.css_roles[role]};`).join("\n")
  return `:root {
${block(light)}
  accent-color: var(--emphasis);
}

@media (prefers-color-scheme: dark) {
  :root {
${block(dark).split("\n").map(line => `  ${line}`).join("\n")}
  }
}

html {
  color: var(--text);
  background-color: var(--surface);
  color-scheme: light dark;
}

body {
  min-height: 100%;
  background-color: inherit;
}

main#realness {
  background-color: inherit;
}

section[data-page] {
  background-color: var(--surface);
}
`
}
