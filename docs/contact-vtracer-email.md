# Contact vtracer — draft email

To: chris.2y3@outlook.com
Subject: Realness uses vtracer

---

Hi Chris,

Just wanted to say thanks. [Realness](https://realness.online) (launching soon) is a free PWA that turns photos into layered SVG posters, and vtracer is the engine behind the mosaic cutouts.

We compile the `l` crate to WASM and bundle it into a dedicated web worker. Image data streams through path by path, entirely on the client. It was the thing that made me think a full client-side poster tool could actually work — potrace had the foundation, but vtracer took it into color and performance territory that made this possible.

The app and source are both at [github.com/realness-online/web](https://github.com/realness-online/web). We've credited vtracer [in the docs](https://realness.online/docs#how-posters-are-made).

Most of Realness was written by hand, pre-AI. The recent work — including the drag-and-drop and a few fixes around it — was done with an AI coding agent, and it felt right to keep that honest when crediting the foundations the app stands on.

Thanks for building something worth building on.

— Scott

---

## Potrace draft

To: selinger@users.sourceforge.net
Subject: Realness uses potrace

Hi Peter,

I've been a long-time admirer of potrace, so I wanted to reach out and say thanks. [Realness](https://realness.online) (launching soon) is a free PWA that turns photos into layered SVG posters, and potrace's algorithm is the foundation of the shadow layers.

I started from [iwsfg/node-potrace](https://github.com/iwsfg/node-potrace), the JavaScript port of your algorithm, and adapted it to run as a dedicated web worker — ES modules, ~3,500 lines, image data processed entirely on the client. It produces four tonal bands (light, regular, medium, bold) that give each poster its depth. I added color detection on top so those layers carry the photo's palette instead of rendering flat.

The fact that the algorithm ported so cleanly to JS speaks to how well-designed the original C code was. We've credited potrace [in the docs](https://realness.online/docs#how-posters-are-made) alongside vtracer.

The app is at [realness.online](https://realness.online) and the source is at [github.com/realness-online/web](https://github.com/realness-online/web).

Most of Realness was written by hand, pre-AI. The recent work — including the drag-and-drop and a few fixes around it — was done with an AI coding agent, and it felt right to keep that honest when crediting the foundations the app stands on.

Project home: [potrace.sourceforge.net](http://potrace.sourceforge.net/)

Thanks for building something that lives on.

— Scott

https://github.com/iwsfg/node-potrace
