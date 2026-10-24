# Shared themes

Edit `apps/realness/themes/<name>/palette.css` and `roles.json`. Generated files are outputs.

- `palette.css`: named OKLCH materials, including alpha when needed.
- `roles.json`: complete `light` and `dark` semantic role maps.
- `adapters/`: web CSS, Ghostty, pi, and nvim format mappings.
- `load.js`: shared validation and color resolution.

Realness keeps document and terminal surfaces distinct. `document-text` serves
web content; `text` serves terminals. These differences are explicit roles.

Run the commands below from the workspace root.

## Maintain Realness

```sh
npm run palette
npm run check:palette
node --test .pi/bin/specs/graphics/themes.spec.js
```

Generation updates existing consumer paths, including nvim and pi. Ghostty's
existing symlinks still work. CSS copies for publishing follow generation.
`.pi/bin/graphics/ghostty-theme.js` remains a compatibility command.

Do not edit generated frontend `palette.css` or `color.css`, terminal theme
files, pi JSON, or nvim Lua. Font settings remain in the frontend's `font.css`;
this consolidation covers colors, not typography.

## Export a client theme

Create `apps/realness/themes/<client-name>/` with both source files. Names use lowercase
letters, digits, and dashes, starting with a letter. Supply all roles from
Realness or the example; material names belong to the client.

```sh
node .pi/bin/graphics/themes.js --theme example-client --out artifacts/themes/example-client
node .pi/bin/graphics/themes.js --theme example-client --out artifacts/themes/example-client --check
```

Exports contain `web/`, `ghostty/`, `pi/`, and `nvim/`. Export does not select or
install a theme. Client exports require `--out`, inside this workspace.
The example proves independent material names; it is not a finished client design.

Role values are material names. Web mixing also accepts
`{"mix": ["text", 70, "surface"]}`. Set `"materials": true` to use material
names rather than role names in a mix. Panel tints accept
`{"tint": "material-name"}`; they use the `raised` material's lightness and cap
chroma at 0.04. Unsupported values and missing materials fail before writing.

Tests pin pre-migration color values in `.pi/bin/specs/fixtures/theme-baseline/`. A deliberate
Realness color change needs a reviewed baseline update.
