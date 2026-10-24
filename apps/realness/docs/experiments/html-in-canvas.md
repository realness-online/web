# HTML-in-Canvas experiment (realness Track B)

Unify the 3D poster viewer with the live SVG morph by rendering the real DOM
poster into the WebGL viewer's shadow textures, instead of baked stills.

Source: https://developer.chrome.com/blog/html-in-canvas-origin-trial

## Status

Origin trial only. No polyfill exists - the article offers none, so the
feature detect is a hard off-switch everywhere else and the viewer degrades to
its current baked textures.

## Enablement (to test)

- Chrome Canary 149+ with `chrome://flags/#canvas-draw-element` enabled, or
- register the origin trial (Chrome 148-150) and ship a token.

## Requirements

- The `<canvas>` must carry the `layoutsubtree` attribute.
- Rendering into a WebGL texture happens inside the canvas `paint` event
  (`canvas.onpaint`), which fires when the element redraws.

## API surface

- WebGL texture upload: `gl.texElementImage2D(TEXTURE_2D, 0, RGBA, RGBA,
UNSIGNED_BYTE, element)` - analog of `texImage2D`, guarded by
  `if (gl.texElementImage2D)`.
- 2D: `ctx.drawElementImage(element, x, y)`.
- WebGPU: `device.queue.copyElementImageToTexture(...)`.
- Positioning an element over its pixels: `element.getElementTransform()`.
- Feature detect: presence of `gl.texElementImage2D` on a live WebGL context.

## Caveats (from the article)

- Cross-origin iframe content is not rendered (security/privacy).
- Scrolling and animations inside canvas-rendered content depend on
  JavaScript / the `paint` event - they do not run on the native DOM clock.
