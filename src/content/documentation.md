<!-- markdownlint-disable MD033 -->
<!-- markdownlint-disable MD024 -->

## Overview

Realness is a camera-first app that turns photos into layered SVG [posters](#posters) and groups them with [statements](#statements) into [thoughts](#thoughts). It all happens on your device. [Sign in](#sign-on) if you want to sync across devices.

### Quick start

Add Realness to your home screen. The camera is the fastest way in - photograph what's in front of you and get a vector poster back.

1. Open [Thoughts](/), tap the camera, and take a picture.
2. Realness traces it into a vector poster with eighteen gradients to pull color from.
3. Write [statements](#statements) alongside your posters to build a thought.
4. [Sign in](#sign-on) with your phone number to sync across devices and show up in the [phonebook](#phonebook).

Posters export as SVG, PNG, PSD, video, or GLB - and drop into Figma, Affinity, Procreate, Adobe, and Blender workflows.

---

### Interface

The action bar and keyboard [shortcuts](#shortcuts) drive the app.

**Pages:** Thoughts (`/`), [about](/about), [documentation](/docs), [pricing](/pricing), [phonebook](/phonebook), [relations](/relations), [account](/account), [sign-on](/sign-on).

**Action bar:**

- **Add** - paste or pick images (multiple files on desktop).
- **3D** - toggle the [3D viewer](#posters).
- **Camera** - take a photo.
- **Animation** - toggle poster [animation](#posters).
- **Settings** - open [preferences](#settings).

Paste an image anywhere to queue a poster. Toggle the action bar with <kbd>M</kbd>.

---

## Thoughts

A thought pairs [posters](#posters) with [statements](#statements) in time. You have 13 minutes to keep adding to one after you start it. Text-only thoughts stand bare on the feed; mixed with posters they read like captions.

Statements written within 13 minutes of a poster attach to it as an overlay caption — you'll see a teal border on the poster when this happens. Those statements don't appear separately in the feed.

### Posters

[Thoughts](/) and [profiles](#profile) show posters in chronological days. Create them from the action bar, camera, or paste.

#### Anatomy of a poster

Each poster is a layered SVG.

**Shadow layers** (lightest to boldest): **Light**, **Regular**, **Medium**, **Bold**, **Background** (optional fill).

**Also:** **Gradients** (eighteen colors from your photo), **Stroke** (outlines along shadow paths), **Mosaic** (transparent cutouts from photo contrast).

**Mosaic layers** (coarsest to finest): **Boulders**, **Rocks**, **Gravel**, **Sand**, **Sediment**. Toggle all with <kbd>g</kbd>, individual layers with uppercase keys (see [Shortcuts](#shortcuts)).

#### Interactive features

- **Animation** - GPU color transitions. <kbd>a</kbd> toggle, <kbd>A</kbd> cycle speed.
- **Drama** - front and back light bars. <kbd>d</kbd> toggle, <kbd>D</kbd> cycle combination.
- **Touch and hover** - mosaic at half opacity. Hover brightens a layer; press and hold isolates one.
- **Fit or fill** - tap to switch meet (inside frame) and slice (fill frame). Long-press on touch.
- **Pan** - drag portrait posters within the frame.
- **Aspect ratio** - <kbd>r</kbd> cycles auto, 1:1, 1.618:1, 16:9, 2.35:1, 2.76:1.
- **Slice alignment** - <kbd>&uarr;</kbd> / <kbd>&darr;</kbd> nudge the crop in slice mode.
- **3D view** - <kbd>q</kbd> or action bar; tune in [settings](#settings).
- **Storytelling** - horizontal feed scroll. <kbd>w</kbd>.
- **Mask pen** - edit mosaic selection on your own posters.

Vector work runs in web workers. View state persists locally. Exports match what you see.

#### Download and export

Each poster has a download menu. A blue sweep border means an export is running. Hidden layers are excluded.

- **SVG** - current visible state, any size. Set `adobe` colors for HEX gradient stops in Adobe tools.
- **PNG** - full poster at 3840px wide, small Realness watermark.
- **PNG layers** - one file per layer (`+` on PNG). Good for compositing.
- **PSD** - **Shadows** (Background, Light, Regular, Medium, Bold), **Stroke**, **Mosaic** (Sediment through Boulders). 3840px desktop, 1920px iOS Safari.
- **Video** - animated `.mov`, 24fps, 1080px short side.
- **GLB** - 3D model for Blender and similar tools.

#### How posters are made

Computer vision, not machine learning:

- **[vtracer](https://github.com/visioncortex/vtracer)** - mosaic cutouts.
- **[potrace](http://potrace.sourceforge.net/)** - shadow layers.

### Statements

Text written in the feed, grouped by day. Can be multiple lines. Tap any statement to edit it in place. URLs are written as text — they aren't turned into links. Works offline without sign-in; syncs once you [sign in](#sign-on).

### Profile

A profile (`/<phone-number>`) shows avatar, posters, and statements by day. Download their posters. Cached offline; visits are not tracked.

---

## Sign-on

[Sign in](/sign-on) with your phone number and a display name. You appear in the [phonebook](#phonebook) at that number. Realness is invisible to search engines — no tracking, no advertising. The server handles auth and storage only; your data lives on your device.

---

## Account

[Account](/account) (sign-in required):

- **Sign off** - sign out.
- **Name** - display name.
- **Sponsorship** - history and option to sponsor (see [Pricing](/pricing)).

---

## Settings

Gear in the action bar or <kbd>,</kbd>. Controls poster look and export.

- **Mosaic** - mosaic cutouts.
- **Shadow** - shadow layers and gradients.
- **Stroke** - shadow outlines.
- **Drama** - dynamic lighting.
- **Export to folder** - sync exports to a folder on your device.

With **3D view** on: mosaic and shadow spread/opacity, camera tilt, haze, drift. Desktop also shows live [shortcut](#shortcuts) reference. Stored locally.

---

## Install

Progressive Web App - install from the browser (Chrome/Edge address bar, Firefox "Install App", Safari "Add to Dock"). Offline-capable, full keyboard shortcuts, desktop GPU.

---

## Sync indicator

Border around the app:

- **Blue sweep** - syncing, exporting, processing, or refreshing.
- **Yellow** - offline; editing paused.
- **None** - online and idle.

---

## Shortcuts

Desktop only. <kbd>?</kbd> opens this documentation.

### Navigation

<kbd>0</kbd> - Thoughts

<kbd>1</kbd> - Phonebook

<kbd>2</kbd> - About

---

### View

<kbd>i</kbd> - Info (FPS and viewport)

<kbd>w</kbd> - Storytelling (side-scroll) view

<kbd>r</kbd> - Cycle aspect ratio (<kbd>Shift</kbd>+<kbd>r</kbd> reverses)

<kbd>p</kbd> - Presentation (fullscreen)

<kbd>M</kbd> - Show/hide the action bar

<kbd>h</kbd> - Show/hide the footer

<kbd>q</kbd> - 3D view

---

### Poster look

<kbd>a</kbd> - Animation &nbsp;&middot;&nbsp; <kbd>A</kbd> - Cycle animation speed

<kbd>d</kbd> - Drama &nbsp;&middot;&nbsp; <kbd>D</kbd> - Cycle drama lights

<kbd>s</kbd> - Stroke

<kbd>f</kbd> - Shadow

<kbd>g</kbd> - Mosaic

---

### Shadow layers

<kbd>z</kbd> - Bold

<kbd>x</kbd> - Medium

<kbd>c</kbd> - Regular

<kbd>v</kbd> - Light

<kbd>b</kbd> - Background

---

### Mosaic layers

<kbd>Z</kbd> - Boulders

<kbd>X</kbd> - Rocks

<kbd>C</kbd> - Gravel

<kbd>V</kbd> - Sand

<kbd>B</kbd> - Sediment

---

### Focused poster

<kbd>&uarr;</kbd> - Slice alignment up

<kbd>&darr;</kbd> - Slice alignment down

---

### System

<kbd>,</kbd> - Open settings

<kbd>.</kbd> - Open account

<kbd>?</kbd> - Show documentation

<kbd>T</kbd> - Clear sync time

---
