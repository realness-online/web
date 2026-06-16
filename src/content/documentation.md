<!-- markdownlint-disable MD033 -->
<!-- markdownlint-disable MD024 -->

## Overview

Realness is a rotoscoping tool. With it you can trace photos into layered SVG **posters** with animatable mosaics, shadows, and gradients. Posters export to SVG, PNG, PSD, video, or GLB. Print layers on transparency film and stack them like Disney-era cel animation.

Everything runs on your device — no AI, just classical computer vision. Sign in to sync, or host your own Realness.

### Quick start

Add Realness to your home screen.

1. Open the app, tap the camera, and take a picture.
2. Realness rotoscopes the photo into a vector poster: five _Mosaic_ layers, four _Shadow_ layers, and up to eighteen gradients pulled from the image.
3. Write statements alongside posters to build a thought.
4. Sign in with your phone number to sync with your community.

---

### Interface

The application **Island** lives at the bottom of your screen.

- <svg><use href="/icons.svg#add"></use></svg> **Add** — file picker for photos you already have. One or many posters.
- <svg><use href="/icons.svg#galaxy"></use></svg> **3D** — toggle the 3D viewer.
- <svg><use href="/icons.svg#camera"></use></svg> **Camera** — quick photo capture, improvisational and fun — zoom without quality loss.
- <svg><use href="/icons.svg#animation"></use></svg> **Animation** — toggle poster animation.
- <svg><use href="/icons.svg#gear"></use></svg> **Preferences** — open the preferences panel.

On desktop, paste anywhere to queue a poster—same queue as **Add**. Keyboard shortcuts are in Preferences.

---

### Thoughts

**Thoughts** pair statements with posters. Each new entry extends the current thought, giving you 13 minutes to build on what you're thinking.

Before you sign in, Thoughts shows only this community's moderator—their posters and statements. Browse to see what this Realness is like; sign in to join and add your own.

Statements within 13 minutes of a poster attach as overlay captions—you'll see a teal border on the poster. Those statements don't appear separately in the feed. Text-only thoughts stand alone.

#### Statements

Text written in the feed, grouped by day. Tap any statement to edit in place. URLs stay as text. They aren't turned into links. Works offline without sign-in; syncs once you sign in.

#### Profile

Shows avatar, posters, and statements by day. Download their posters. Cached offline; visits are not tracked.

---

### Posters

Posters appear in Thoughts and on profiles, grouped by day. Use **Add** or **Camera** on the island, or paste on desktop.

#### Anatomy of a poster

Each poster is a layered SVG.

**Mosaic** — transparent cutouts from photo contrast. Five layers: Boulders, Rocks, Gravel, Sand, Sediment. In 3D view, finer layers are raised creating the illusion of dimension.

**Shadow** — tonal bands (lightest to boldest): Light, Regular, Medium, Bold. Background is an optional fill behind them.

**Stroke** — outlines along the shadow paths.

**Gradients** — eighteen colors from your photo, coloring the shadows.

#### Interactive features

- **Poster menu** — on touch, long-press a poster to open download, mask pen, and more. On desktop, click the poster.
- **Animation** — GPU color transitions; toggle and cycle speed from Preferences.
- **Drama** — front and back light bars; toggle and cycle combinations from Preferences.
- **Mosaic layers** — on touch, press and hold to isolate a layer. On desktop, hover to highlight the layer under the cursor; click to isolate.
- **Fit or fill** — long-press toggles meet (inside frame) and slice (fill frame). On desktop, click.
- **Pan** — portrait slice mode: swipe left or right to move the poster within the frame.
- **Aspect ratio** — cycle presets from Preferences on desktop.
- **Slice alignment** — nudge the crop in slice mode from Preferences on desktop.
- **Storytelling** — horizontal feed scroll from Preferences on desktop.
- **Presentation** — a keyboard shortcut fills the screen with the poster and hides the interface. Press it again to exit. The key is listed in Preferences.
- **Mask pen** — edit mosaic selection on your own posters.
- **Set as avatar** — on your own posters, the poster menu makes that poster your profile avatar.

#### 3D viewer

Toggle from the island or Preferences. With 3D on, tune spread, opacity, camera, atmosphere, and motion in the preferences panel.

**Mobile** — drag to pan. Tilt follows your finger and device gyro (when allowed).

**Desktop** — drag for parallax. Hold a modifier while dragging or scrolling to pan; scroll with the primary modifier to zoom; arrow keys tilt. The exact keys are listed in Preferences when 3D is on.

Vector work runs in web workers. View state persists locally.

#### Download and export

Open the poster menu first (long-press on touch, click on desktop). A blue sweep border means an export is running.

Exports clone the live poster on screen—not a separate render path.

- **SVG** — matches what you see (visible layers, opacity, crop, drama). Any size. Turn on the **adobe** color preference to write HEX gradient stops that Adobe tools read correctly.
- **PNG** — same flat snapshot at 3840px wide, plus a small Realness watermark.
- **PNG layers** — one file per layer for compositing—not one on-screen snapshot.
- **PSD** — Shadows (Background, Light, Regular, Medium, Bold), Stroke, Mosaic (Sediment through Boulders). Separate layers for printing. 1920px on touch, 3840px on desktop.
- **Video** — one animation cycle as `.mov`, 24fps, 1080px short side. Export speed is fixed.
- **GLB** — 3D model for Blender and similar tools. Uses the open 3D viewer when it is on; otherwise builds from the poster.

#### Printing a cel animation

Posters are built for transparency. Mosaic cutouts stay clear; shadow and gradient layers stack like colored gels—made to shine through on a light table or projector. Each printed sheet is a **cel**: register a stack of them and you get the same layered look golden-age Disney and the other hand-painted studios used.

There are three ways to print, depending on how much of that layering you want to do by hand.

**Print the whole poster.** Export **PNG** or **SVG** and send the full poster to one sheet of overhead film. Every layer lands already composited—one cel, the fastest path, and the closest to what's on screen. Choose this when you want a finished image on transparency without assembling anything.

**Print each layer.** Export **PNG layers** or **PSD** and print one layer per sheet of transparency. PSD keeps them named and ordered for you—Shadows (Background, Light, Regular, Medium, Bold), Stroke, then Mosaic (Sediment through Boulders). This is the path for registration: trim to a common edge or use registration holes so each sheet drops into the same position.

**Stack all of it together for the full experience.** Print the layers, print the **background** on paper—it gives the shadows something to sit on—and register the transparencies on top of it in order, lightest shadow to boldest, mosaic on top. Light it from behind on a light table or projector and you're looking at a hand-built cel: the layers read as depth, and you can lift, swap, or re-shoot individual sheets the way an animation stand does.

A **laser printer** (toner) is the best fit for the film: sharp vector edges, opaque color where you need it, clear where you don't. Inkjet transparencies work in a pinch—let the ink dry fully before stacking.

#### How posters are made

No AI. Classical computer vision on your device—not machine learning or generative models. Realness doesn't do the hard part of tracing itself; it stands on two open-source projects that have spent years getting it right, and owes them the credit.

- **[vtracer](https://github.com/visioncortex/vtracer)**, by the [visioncortex](https://www.visioncortex.org/) team — turns photo contrast into the **mosaic** cutouts. The five mosaic layers are vtracer's color-region tracing, tuned for the look Realness is after. It does the work that makes the layered, stained-glass quality of a poster possible.
- **[potrace](http://potrace.sourceforge.net/)**, by Peter Selinger — the starting point for the **shadow** layers. The tonal bands (Light, Regular, Medium, Bold) and the strokes along them began as potrace and have since been heavily rewritten to Realness's needs. The foundation—turning a bitmap into clean, hand-inked curves—is Selinger's; what grew from it is its own thing.

Both are the real engine of a poster. Realness is the darkroom around them—capture, layering, color, and export.

---

### Sign-on

Sign in with your phone number and a display name. You join **this** instance. Your posters and statements show in Thoughts alongside everyone else.

Realness is one instance per moderator. A small community of their people. You can sign in here to try it and participate. The real community is the one you build by hosting your own for your studio, family, union hall, or circle. See **Project** below for setup and docs.

Realness is invisible to search engines—no tracking, no advertising. The server handles auth and storage only; your data lives on your device.

---

### Account

Sign-in required:

- **Sign off** — sign out.
- **Name** — display name.
- **Sponsorship** — history and option to sponsor.

---

### Install

Progressive Web App—install from the browser (Chrome/Edge address bar, Firefox "Install App", Safari "Add to Dock"). Works offline. Desktop adds full keyboard shortcuts and desktop GPU.

---

### Sync

Sync runs when you return to the app—the tab or window becomes visible again.

- **Your work** — posters, statements, and profile changes upload as soon as you're online.
- **Community updates** — other people's posters and statements download at most once every eight hours.

Border around the app:

- **Blue sweep** — syncing, exporting, processing, or refreshing.
- **Yellow** — offline; editing paused.
- **None** — online and idle.

A **teal** border is different: it sits on a single poster (not the app frame) to mark attached caption statements — see [Thoughts](#thoughts).

---

### Project

Realness is open source. This page covers using the app; the repo has setup, deploy, and deeper background.

- **[README](https://github.com/realness-online/web)** — overview, local dev, Firebase deploy.
- **[Philosophy](https://github.com/realness-online/web/blob/main/docs/philosophy.md)** — why moderators, small communities, and client-first design.
- **[Architecture](https://github.com/realness-online/web/blob/main/docs/architecture.md)** — storage, sync, offline-first, serverless stack.
- **[Contributing](https://github.com/realness-online/web/blob/main/docs/contributing.md)** — branch workflow, tests, pull requests.
- **[Verify a release](https://github.com/realness-online/web/blob/main/docs/verify-release.md)** — confirm a deployed instance matches a tagged build.
