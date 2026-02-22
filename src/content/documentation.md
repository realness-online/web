<!-- markdownlint-disable MD033 -->
<!-- markdownlint-disable MD024 -->

## Overview

[Posters](#posters) and [Thoughts](#thoughts) are what you make with Realness. Each poster is an SVG graphic that is small; able to go directly on the web yet expressive and fun designed to encourage drawing and supportive to the myriad of digital pursuites. Posters are designed to be flexible, they integrate into toolchains, or can be efficently embeded into websites without optimiztions.

### Where to begin

You save it to your home screen; Realness works great on a phone for when you want to take photos and turn them into Posters. Dramatic with low fidelity, you get the quality visuals even with digital zoom. Walking around making posters is a good time. Explore composition or framing – Realness is a tool to spark your creative journeys.

from the [homepage](https://realness.online) click on the camera, take a picture, and Realness will create a super fun rotoscope vector graphic.

Multilayered and designed to give you the most creative direction. Each photo has eighteen gradients for you to pull color from. Realness integrates right into Figma, Affinity, Procreate, or Adobe toolchains.

enabling EXIF, and Model Context Protocol integration will provide an elegent interfact for integrating realness into 3d worflows (blender first). With chat and audio integration on the way it's a powerful tool for a new age of creative work.

### What You Can Do

Start by [signing up](#sign-on) with your phone number and creating an avatar to join the community. Once you're in, you can begin creating [statements](#statements) that become trains as you add to them over time.

Take pictures and develop them into [vector graphics](#posters) that you can use as posters - each one is a digital paintbrush with eighteen gradients to pull colors from. Download and share these posters with your creative workflow.

Connect with others by browsing the [phonebook](#phonebook) to find people you may know on Realness. Add them to your network and view their content in your [feed](#thoughts), where you'll see a chronological stream of statements and posters from everyone you follow.

View upcoming [events](#events); create your own. When something moves you, reach out directly - there are no likes or comments here, just genuine connection through animated posters and text messaging to people you care about.

Realness updates at eight-hour intervals.

You can sync Realness across all your devices. Take a picture on your phone and then open realness on your ipad and send it to Procreate (via affinity designer).

---

## Navigation

[Main home screen](/)

The navigation provides quick access to all major sections of the app. You'll find the camera for creating [posters](#posters), a writing interface for [statements](#statements), version information, help links, and account dialog access right from the main screen.

All navigation works offline, with camera access for poster creation and local thought storage. There's no tracking or analytics - everything stays on your device.

**Sync Indicator**: The app displays a border around the main interface to show sync status:

- **Green pulsing border** - Active syncing or processing in progress. This includes uploading posters from local storage to the network, syncing thoughts, events, user profile, downloading files (PNG, PSD, video), image processing, and other content operations
- **Yellow border** - Device is offline
- **No border** - Normal operation, online and not currently syncing

The sync indicator appears automatically during all background sync operations and file downloads, ensuring you can see when content is being synchronized or processed.

---

## Posters

[Gallery](/posters) of your vector graphics and poster management

The posters view shows a grid display of all your vector graphics. You can add new posters through the camera or file picker, process entire directories of images in batch, and delete posters with a confirmation dialog. Each poster has an author menu for additional options.

### Anatomy of a Poster

Each poster is a layered SVG vector graphic with multiple components that give you creative control over the final result. Understanding these parts helps you make the most of your posters.

**Core Layers** (from lightest to boldest):

- **Light Layer** - Subtle highlights and fine details that add depth and texture
- **Regular Layer** - The main form and structure of your image, the foundation
- **Medium Layer** - Stronger shapes and mid-tones for definition and contrast
- **Bold Layer** - Darkest elements and strong contrast areas that create impact

**Visual Elements**:

- **Fill Gradients** - Eighteen color gradients automatically extracted from your photo that you can apply to any layer
- **Stroke Outlines** - Vector paths that trace the edges of shapes for definition and emphasis
- **Background** - Optional fill that can be toggled on/off to frame your poster
- **Mosaic** - Special transparent areas that let background content show through, creating windows in your poster

**Mosaic Layer**:

The mosaic layer is generated using the vtracer algorithm and creates transparent windows through your poster. Each mosaic element is a vector path with:

- **Interactive Touch Response** - Mosaic elements respond to touch with brightness and saturation effects that create visual feedback
- **Auto-hide Animation** - After interaction, mosaic elements automatically return to their base state over 3 seconds
- **Opacity Control** - Mosaic elements have a default 50% opacity that increases to 75% on hover and 100% on active touch
- **Visual Effects** - Brightness and saturation filters create dramatic lighting effects when interacting with mosaic elements
- **Toggle Visibility** - Use <kbd>G</kbd> to show/hide all mosaic across your posters

Mosaic is perfect for creating layered compositions, overlaying on other content, or adding interactive elements to your posters. It's generated automatically from your photo's contrast areas and provides a unique way to frame and highlight different parts of your image.

**Interactive Features**:

- **Animation** - GPU-powered color transitions that bring posters to life with flowing movements
- **Lightbar** - Dramatic lighting effect that adds cinematic flair and depth
- **Pan & Zoom** - True SVG scaling from 50% to 300% with crisp rendering at any size
- **Layer Visibility** - Toggle individual layers on/off to explore the different parts of a poster

**Creative Possibilities**:

Posters are downloaded in the state of the UI So that what you see is what you download. Playing these preferences let you create various effects - from solid fills to outline-only looks, or combinations that give you maximum flexibility.

The mosaic system creates transparent windows through your poster, perfect for overlaying on other content or creating layered compositions. Mosaic elements respond to touch with brightness and saturation effects, making them interactive elements.

The animation system uses your GPU to create flowing color transitions that make static images feel alive. Combined with the lightbar effect, you can create cinematic moments that draw attention and add emotional impact.

All these elements work together to transform your photos into expressive vector graphics that maintain their quality at any size while giving you the creative tools to make them uniquely yours.

All editing happens locally with vector optimization in web workers and view state persisted in localStorage. There's no server-side processing required.

### Download Options

Each poster includes a download menu with multiple format options. The green pulsing border indicates when downloads are in progress.

**Available Formats**:

- **SVG** - Vector format perfect for web, scalable to any size without quality loss. Exports the current state of all visible layers.
- **PNG** - Full poster rendered as a single high-resolution PNG (4K width). Includes the Realness icon watermark in the corner. Great for sharing on social media or printing.
- **PNG Layers** (icon on PNG option) - Downloads each layer as a separate PNG file. Core layers (Background, Light, Regular, Medium, Bold) and mosaic layers (Sediment, Sand, Gravel, Rocks, Boulders) are exported individually. Perfect for compositing in other tools or creating custom layer arrangements.
- **PSD** - Photoshop document with all layers organized into groups. Ready to open directly in Procreate, Affinity Designer, or Adobe Photoshop. Includes shadow layers (Shadows group), stroke layers (Stroke group), and mosaic layers (Mosaic group). Each layer is fully editable with proper transparency and organization.

All downloads respect your current visibility settings, so hidden layers won't appear in the exported files. Downloads are rendered at 4K resolution for maximum quality.

---

## Thoughts

The thoughts view shows a chronological feed of [posters](#posters) and statements from everyone you follow. Thoughts are statements and posters combined. The feed combines content from all your [relations](#relations) with real-time updates from local storage.

Time is organized into trains. for thirteen minutes after a poster is created or you make a statement your additional posters and statements will be added to this train. each new poster resets the timer. so you can keep a thought going or just let it go. You can view a timeline of all content from you and your relations.

---

## Statements

The statements interface lets you write and edit your statements. Content is organized into days and integrates seamlessly with your [thoughts](#thoughts) feed.

Statements work offline. You don't have to sign in to make them, but they are shared once you [sign in](#sign-on)

All content is stored locally and works completely offline. There are no server-side feed algorithms - you control what content appears in your timeline.

### Profile

**Purpose**: Individual user profiles and content

Each profile displays the user's avatar and information alongside a chronological content timeline. You can send direct messages and download [posters](#posters), with everything organized by days for easy browsing.

Profile data is stored locally with content cached for offline viewing. There's no tracking of profile visits, and users control their own data completely.

---

## Events

The events view displays upcoming events from you and your [relations](#relations). You can create new events from [posters](#posters) and see everything in chronological order, with full integration into your poster workflow.

Events are stored locally with no server-side coordination. You control event visibility completely, and the calendar works offline

---

# Extra

Creating your own realness is the goal of the project. I need to think through how to talk about this part of the app.

## PhoneBook

The phonebook lets you browse all users in the network and sign up new users. You have access to [relations](#relations) management and can discover people you might want to connect with.

The user directory is cached locally with a client-side sign-up process. There's no tracking of user discovery, and the phonebook works offline after the initial load.

### Sign-on

If you choose to sign in, you will show up in the [phonebook](#phonebook). People can message you via the phone number you signed in with. Realness is blind to search engines and has no tracking or advertising. It's a tool for reference that you can invite people you care about to use and share.

The sign-on process uses phone number authentication with name setup for new users. You have account cleanup options and integration with Firebase Auth, but with minimal server interaction - only for authentication. Your account data is managed locally, and you control your authentication with a clean slate option for privacy.

### Relations

**Purpose**: Manage your social connections

The relations view shows a list of people you follow with quick access back to the [phonebook](#phonebook). Each relation gets a profile card, and you can navigate directly to individual [profiles](#profile) from here.

Relations sync across your devices. You control your network completely.

---

# Integrations

## Procreate

You can download posters directly as PSD files for use in Procreate. Click the download icon on any poster and select **PSD** from the menu. The PSD file includes all layers organized into groups:

- **Shadows Group** - Contains Background, Light, Regular, Medium, and Bold layers
- **Stroke Group** - Contains Light Stroke, Regular Stroke, Medium Stroke, and Bold Stroke layers (outline paths only)
- **Mosaic Group** - Contains Sediment, Sand, Gravel, Rocks, and Boulders layers

Each layer is exported as a separate editable layer in the PSD, giving you full control in Procreate. The PSD files are optimized for creative workflows and maintain all layer structure from Realness.

**Alternative Workflow**: If you prefer, you can still download as SVG and convert to PSD using Affinity Designer or Adobe Illustrator, but direct PSD download is now available for immediate use.

---

## Desktop

Realness is a Progressive Web App (PWA) that you can install on your desktop for a native experience. Once installed, it works offline and feels like a native application.

**Installation**:

1. Visit [realness.online](https://realness.online) in any modern browser
2. Look for the install prompt in your browser's address bar or menu
3. Click "Install" to add Realness to your desktop
4. Launch from your desktop, start menu, or applications folder

**Browser-Specific Instructions**:

- **Chrome/Edge**: Install icon appears in address bar
- **Firefox**: Menu → "Install App"
- **Safari**: File → "Add to Dock"

**Desktop Benefits**:

- Full keyboard shortcut support for power users
- Larger screen real estate for poster editing
- Native app performance and offline access
- Automatic updates when you visit the site
- Works seamlessly with your existing creative workflow

The desktop version maintains the same functionality as the web version, But lets you take advantage of desktop GPU's with enhanced performance for intensive poster editing.

---

## Shortcuts

The _settings_ Dialog <kbd>.</kbd> is accessed from the bottom left of the app.

Here you can manage visual preferences like shadow, stroke, emboss, and animate settings that control how [posters](#posters) are viewed and downloaded.

All preferences are stored locally with no server-side sync, giving you control over your settings while working offline.

### Keyboard

<kbd>0</kbd> - Go to home

<kbd>1</kbd> - Go to thoughts

<kbd>2</kbd> - Go to posters

<kbd>3</kbd> - Go to statements

<kbd>4</kbd> - Go to phonebook

<kbd>5</kbd> - Go to events

<kbd>6</kbd> - Go to about

---

<kbd>I</kbd> - Toggle Info FPS / Viewport

<kbd>O</kbd> - Toggle storytelling (side-scroll) view

<kbd>P</kbd> - Toggle fullscreen mode

---

<kbd>A</kbd> - Toggle Animation

<kbd>S</kbd> - Toggle Shadow Stroke

<kbd>D</kbd> - Toggle Dramatic lighting

<kbd>F</kbd> - Toggle Shadow

<kbd>G</kbd> - Toggle Mosaic

---

<kbd>Z</kbd> - Toggle bold

<kbd>X</kbd> - Toggle medium

<kbd>C</kbd> - Toggle regular

<kbd>V</kbd> - Toggle light

<kbd>B</kbd> - Toggle background

---

<kbd>.</kbd> - Open settings dialog

<kbd>?/</kbd> - Show documentation

---

### Numpad

<kbd>0</kbd> - Toggle Animation

<kbd>.</kbd> - Toggle Drama

---

<kbd>1</kbd> - Toggle Mosaic

<kbd>2</kbd> - Toggle Shadow

<kbd>3</kbd> - Toggle Stroke

---

<kbd>4</kbd> - Go To Phonebook

<kbd>5</kbd> - Go To Posters

<kbd>6</kbd> - Go To Navigation

---

<kbd>7</kbd> - Toggle Info

<kbd>8</kbd> - Toggle Storytelling

<kbd>9</kbd> - Toggle Fullscreen

---

<kbd>/</kbd> - Toggle Bold

<kbd>\*</kbd> - Toggle Medium

<kbd>-</kbd> - Toggle Regular

<kbd>+</kbd> - Toggle Light

<kbd>Enter</kbd> - Toggle Background

---

## Artificial Intelligence

Realness does not use any artificial intelligence or machine learning. All vector graphics are created using traditional computer vision techniques.

Posters are generated using:

- **[vtracer](https://github.com/visioncortex/vtracer)** - Creates the poster mosaic
- **[potrace](http://potrace.sourceforge.net/)** - creates shadow layers

You are free to use posters however you wish.
