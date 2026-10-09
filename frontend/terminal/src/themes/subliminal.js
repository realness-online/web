// Ghostty theme "Subliminal", from /Applications/Ghostty.app/Contents/Resources/ghostty/themes/Subliminal
// palette lines 0-15, plus background/foreground/cursor and selection.

const HEX_RADIX = 16
const rgb = hex => hex.match(/../g).map(channel => parseInt(channel, HEX_RADIX))

export const subliminal = {
  background: rgb('282c35'),
  foreground: rgb('d4d4d4'),
  cursor: rgb('c7c7c7'),
  cursor_text: rgb('8c8c8c'),
  selection_background: rgb('484e5b'),
  selection_foreground: rgb('ffffff'),
  palette: [
    rgb('7f7f7f'),
    rgb('e15a60'),
    rgb('a9cfa4'),
    rgb('ffe2a9'),
    rgb('6699cc'),
    rgb('f1a5ab'),
    rgb('5fb3b3'),
    rgb('d4d4d4'),
    rgb('7f7f7f'),
    rgb('e15a60'),
    rgb('a9cfa4'),
    rgb('ffe2a9'),
    rgb('6699cc'),
    rgb('f1a5ab'),
    rgb('5fb3b3'),
    rgb('d4d4d4')
  ]
}
