<!-- markdownlint-disable MD033 -->
<!-- markdownlint-disable MD024 -->

## Overview

Realness is a rotoscoping tool. It traces a photo into a layered SVG **poster** - mosaics, shadows, and gradients you can animate. Posters export as SVG, PNG, PSD, video, or GLB. Print the layers on transparency film and stack them the way Disney-era cel animation was made.

Everything runs on your device. No AI, just classical computer vision. Sign in to sync with a small community. What you make uploads right away; the feed catches up on an eight-hour rhythm. Or host your own Realness.

### Quick start

[Add Realness to your home screen](#install).

1. Open the app, tap the camera, and take a picture.
2. Realness rotoscopes the photo into a vector poster: five _Mosaic_ layers, four _Shadow_ layers, and up to eighteen gradients pulled from the image.
3. Write statements alongside posters to build a thought.
4. Sign in with your phone number to sync across your devices.

---

### Interface

The application **Island** lives at the bottom of your screen.

- <svg><use href="/icons.svg#add"></use></svg> **Add** - file picker for photos you already have. One poster or many.
- <svg><use href="/icons.svg#galaxy"></use></svg> **3D** - toggle the 3D viewer.
- <svg><use href="/icons.svg#camera"></use></svg> **Camera** - quick photo capture. Zoom without losing quality.
- <svg><use href="/icons.svg#animation"></use></svg> **Animation** - toggle poster animation.
- <svg><use href="/icons.svg#gear"></use></svg> **Preferences** - open the preferences panel.

On desktop, paste anywhere to queue a poster. Same queue **Add** uses. Keyboard shortcuts are in Preferences.

---

### Thoughts

**Thoughts** pair statements with posters. Each new entry extends the current thought, so you have 13 minutes to build on what you're thinking.

#### Statement input

A pill-shaped text field sits at the top of the feed. It's always visible. Tap or click to focus, type your statement, and leave the field to save. The field grows with your text. Press **Tab** to jump to the first poster in the feed.

A statement written within 13 minutes of a poster attaches to it as an overlay caption, marked by a teal border. Those don't appear separately in the feed. Text-only thoughts stand alone.

#### Community feed

Thoughts is a shared feed for your instance. A small circle of people, not the whole internet. There are no likes, counts, or comments. When something moves you, you text the person.

Before you sign in, Thoughts shows only the community moderator's posts. Sign in to see the full community feed and add your own.

Top left of Thoughts is a switch with three silhouettes. **Red** means phonebook mode, the full community feed. Tap it to toggle between the phonebook and a feed of just your work.

The feed moves on an eight-hour rhythm, not a live stream. What you post on this device still goes up right away. Realness is not built to keep you checking back.

#### Statements

Text entries in the feed, grouped by day. Tap any statement to edit it in place. URLs stay as plain text, not links. Works offline without sign-in, and syncs once you sign in.

#### Profile

Tap an avatar in the feed to open that person's profile - their posters and statements grouped by day. Download any poster. Profiles are cached offline, and visits are not tracked.

---

### Posters

Posters appear in Thoughts and on profiles, grouped by day. Use **Add** or **Camera** on the island, or paste on desktop.

#### Anatomy of a poster

Each poster is a layered SVG.

**Mosaic** - transparent cutouts from photo contrast. Five layers: Boulders, Rocks, Gravel, Sand, Sediment. In 3D view the finer layers are raised, which reads as depth.

**Shadow** - tonal bands, lightest to boldest: Light, Regular, Medium, Bold. Background is an optional fill behind them.

**Stroke** - outlines along the shadow paths.

**Gradients** - eighteen colors from your photo, coloring the shadows.

#### Interactive features

- **Poster details** - long-press a poster on touch, or click it on desktop, to expand its caption area. Your own posters show overlay statements, download, and set-as-avatar. Other people's show their profile chip and a download button.
- **Animation** - GPU color transitions. Toggle and cycle speed from Preferences.
- **Drama** - front and back light bars. Toggle and cycle combinations from Preferences.
- **Mosaic layers** - on touch, press and hold to highlight a layer. On desktop, hover to highlight the layer under the cursor.
- **Fit or fill** - long-press toggles between meet (poster inside the frame) and slice (poster fills the frame). On desktop, click.
- **Pan** - in portrait slice mode, swipe left or right to move the poster within the frame.
- **Aspect ratio** - cycle presets from Preferences on desktop.
- **Slice alignment** - nudge the crop in slice mode from Preferences on desktop.
- **Storytelling** - switch the feed to horizontal scroll from Preferences on desktop.
- **Presentation** - a keyboard shortcut fills the screen with the poster and hides the interface. Press again to exit. The key is listed in Preferences.
- **Set as avatar** - on your own posters, the poster details area sets that poster as your profile avatar.

#### Subjects — being built live

Your own posters have a mask pen, the ✎ in the poster menu, for grouping mosaic cells into **subjects**. A subject is a thing in the picture: a face, a flower, the foreground. Press a cell and drag to grow the selection out through cells of a similar tone. Press an already-selected cell and drag to erase. Pinch to zoom in for precision.

This one is being written in the open. Today you can create and color subjects on a poster, but **saving them isn't wired up yet**, so a subject lives only for the current session. Naming, saving, and pulling a subject out as its own layer come next.

Your feedback shapes it while it's being built. Try the grow-select and tell me how it should feel - [open an issue](https://github.com/realness-online/web/issues) or say hello in [About](/about).

#### 3D viewer

Toggle it from the island or Preferences. With 3D on, tune spread, opacity, camera, atmosphere, and motion in the preferences panel.

**Mobile** - drag to pan. Tilt follows your finger and device gyro, when allowed.

**Desktop** - drag for parallax. Hold a modifier while dragging or scrolling to pan. Scroll with the primary modifier to zoom. Arrow keys tilt. The exact keys are listed in Preferences when 3D is on.

Vector work runs in web workers. View state persists locally.

#### Download and export

Open the poster menu first: long-press on touch, click on desktop. A blue sweep border means an export is running.

Exports clone the live poster on screen. There is no separate render path.

- **SVG** - matches what you see: visible layers, opacity, crop, drama. Any size. Turn on the **adobe** color preference to write HEX gradient stops that Adobe tools read correctly.
- **PNG** - the same flat snapshot at 3840px wide, plus a small Realness watermark.
- **PNG layers** - one file per layer for compositing, rather than one on-screen snapshot.
- **PSD** - separate layers for printing: Shadows (Background, Light, Regular, Medium, Bold), Stroke, Mosaic (Sediment through Boulders). 1920px on touch, 3840px on desktop.
- **Video** - H.264 `.mov`, 24fps, up to 4K, animating at the speed your **animation** preference is set to. Drag an **audio file** (mp3, wav, ogg, m4a, flac) onto the poster to bake that track in as the soundtrack, uncompressed.
- **GLB** - 3D model for Blender and similar tools. Uses the open 3D viewer when it is on, and otherwise builds from the poster.

##### Poster video with audio, in one drag

Want your track baked into a video of a poster? Drag it on. No video editor, no timeline.

1. **Drop a track on a poster.** Any audio file: mp3, wav, ogg, m4a, aac, or flac. Drag it onto the bare poster tile, no menu needed. It decodes on your device and nothing is uploaded.
2. **The video runs exactly as long as your song.** The poster animates for the whole track, however long it is. It does not stop at the end of a cycle and hold.
3. **Audio is baked in, uncompressed.** The exported H.264 4K `.mov` carries your track as PCM, so it arrives in your DAW without a second round of lossy encoding. It plays anywhere, and drops straight into **Ableton Live, Resolve, Premiere, Final Cut**, or **YouTube**.

A blue sweep border and a frame counter on the poster show progress while the export runs.

Set the **animation** preference before exporting. Motion speed and layers are the pace of the video, the same motion you are watching on the poster. With no audio, the video is one full cycle at that speed. The poster is vector, so the 4K rasterize stays crisp however you scale it.

##### Batching posters

Want to turn a video into posters? You can do it from the terminal. A whole folder of photos too.

- **A video** - `npm run poster:video -- clip.mov` makes a poster of every frame and puts them back together as an mp4.
- **A folder** - `npm run poster -- ./photos` makes a poster of every photo in it. Each one keeps the name of its photo.
- **One photo** - `npm run poster -- photo.jpg`

These run the app in a hidden browser, so you get the same tracer, the same layers, and the same exports as tapping through them yourself.

Add `--formats svg,png,psd,glb` to pick what comes out. Add `--fps` to a video for its frame rate. Everything lands in `artifacts/poster-driver/`.

You run this from the code, not the app. You need the repo, Node, and a Chromium browser on whichever machine does the work - the [README](https://github.com/realness-online/web) covers getting set up. Nothing is uploaded - the tracing happens there, exactly as it happens in your tab.

#### Printing a cel animation

Posters are built for transparency. Mosaic cutouts stay clear, and shadow and gradient layers stack like colored gels, made to shine through on a light table or projector. Each printed sheet is a **cel**. Register a stack of them and you get the layered look the hand-painted studios used.

There are three ways to print it, depending on how much of that layering you want to do by hand.

**Print the whole poster.** Export **PNG** or **SVG** and send the full poster to one sheet of overhead film. Every layer arrives already composited. One cel, the fastest path, and the closest to what's on screen. Choose this when you want a finished image on transparency without assembling anything.

**Print each layer.** Export **PNG layers** or **PSD** and print one layer per sheet of transparency. PSD keeps them named and ordered for you: Shadows (Background, Light, Regular, Medium, Bold), Stroke, then Mosaic (Sediment through Boulders). This is the path for registration. Trim to a common edge, or use registration holes, so each sheet drops into the same position.

**Stack all of it together.** Print the layers. Print the **background** on paper, which gives the shadows something to sit on. Register the transparencies on top of it in order, lightest shadow to boldest, mosaic on top. Light it from behind on a light table or projector and you are looking at a hand-built cel. The layers read as depth, and you can lift, swap, or re-shoot single sheets the way an animation stand does.

A **laser printer** suits the film best: sharp vector edges, opaque color where you need it, clear where you don't. Inkjet transparencies work in a pinch. Let the ink dry fully before stacking.

#### How posters are made

No AI. Classical computer vision, on your device, rather than machine learning or generative models. Realness doesn't do the hard part of tracing itself. It stands on two open-source projects that have spent years getting it right, and owes them the credit.

- **[vtracer](https://github.com/visioncortex/vtracer)**, by the [visioncortex](https://www.visioncortex.org/) team, turns photo contrast into the **mosaic** cutouts. The five mosaic layers are vtracer's color-region tracing, tuned for the look Realness is after. It does the work that makes the stained-glass quality of a poster possible.
- **[potrace](http://potrace.sourceforge.net/)**, by Peter Selinger, is the starting point for the **shadow** layers. The tonal bands (Light, Regular, Medium, Bold) and the strokes along them began as potrace and have since been heavily rewritten. Turning a bitmap into clean, hand-inked curves is Selinger's foundation. What grew from it is its own thing.

Both are the real engine of a poster. Realness is the darkroom around them: capture, layering, color, and export.

---

### Sign-on

Sign in with your phone number and a display name. You join **this** instance. Your posters and statements show in Thoughts alongside everyone else.

Realness is one instance per moderator, a small community of their people. You can sign in here to try it and take part. The real community is the one you build by hosting your own, for your studio, family, union hall, or circle. See **Project** below for setup and docs.

Realness is invisible to search engines. No tracking, no advertising. The server handles auth and storage only, and your data lives on your device.

---

### Account

Sign-in required:

- **Sign off** - sign out.
- **Name** - display name.

---

### Install

Realness is a Progressive Web App. Install it and it runs like a native app: offline, with full keyboard shortcuts and desktop GPU. The walkthrough below matches your device. Open **Other devices** for the rest.

<!-- install-guide -->

---

### Sync

Sync runs when you return to the app or come back online.

#### What goes up

Posters, statements, profile changes, and anything you saved offline on **this device** upload as soon as you have a connection.

#### What comes down

Realness checks for new work once every eight hours, not more often. Open the app at noon and again at three and you will see the same feed. Open it the next morning and you will see what posted overnight.

That check brings in statements from your other devices, plus new profiles, statements, events, and posters from everyone on the instance. Your name and avatar are verified every visit. The rest waits for the eight-hour mark.

Slow on purpose. No live ticker, no reason to refresh every few minutes. Open the app, catch up, make something, leave.

When sync runs, changed profiles and statements refresh and the feed reloads. A blue sweep border around the app means sync is in progress.

#### Status borders

Border around the app:

- **Blue sweep** - syncing, exporting, processing, or refreshing.
- **Yellow** - offline, editing paused.
- **None** - online and idle.

A **teal** border is different. It sits on a single poster rather than the app frame, and marks attached caption statements. See [Thoughts](#thoughts).

---

<!-- instance-prompt -->

### A Realness of your own

The Realness source code is available. This page documents the tool. The repo has setup, deploying your own, and deeper background to explore.

- **[README](https://github.com/realness-online/web)** - overview, local dev, Firebase deploy.
- **[Philosophy](https://github.com/realness-online/web/blob/main/docs/philosophy.md)** - why moderators, small communities, and client-first design.
- **[Architecture](https://github.com/realness-online/web/blob/main/docs/architecture.md)** - storage, sync, offline-first, serverless stack.
- **[Contributing](https://github.com/realness-online/web/blob/main/docs/contributing.md)** - branch workflow, tests, pull requests.
- **[Verify a release](https://github.com/realness-online/web/blob/main/docs/verify-release.md)** - `npm run verify` confirms a live instance matches a GitHub release.
