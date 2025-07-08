# Realness online

## Documenation

Realness makes vector graphics from images. it's hoped to support artists in their hunt for reference. Each poster is an SVG graphic designed to integrate into toolchains. It works best on a phone when you save it to your home screen. You get a fun experience no matter the device.

from the [homepage](https://realness.online) click on the camera, take a picture, and Realness will create a super fun rotoscope vector graphic.

Multilayered your image is a digital paintbrush designed to to be endlessly usefull. Each photo has eighteen gradients for you to pull color from. Realness integrates right into Figma, Affinity, Procreate, or Adobe toolchains.

enabling EXIF, and Model Context Protocol integration will provide an elegent interfact for integrating realness into 3d worflows (blender first). With chat and audio integration on the way it's a powerful tool for a new age of creative work.

---

## Sync

Realness updates at eight-hour intervals.

You can sync Realness across all your devices. Take a picture on your phone and then open realness on your ipad and send it to Procreate (via affinity designer).

[Settings](#settings) can be changed via the gear icon at the bottom left of the screen

## What You Can Do

Start by [signing up](#sign-on) with your phone number and creating an avatar to join the community. Once you're in, you can begin creating [statements](#statements) that become trains of thought as you add to them over time.

Take pictures and develop them into [vector graphics](#posters) that you can use as posters - each one is a digital paintbrush with eighteen gradients to pull colors from. Download and share these posters with your creative workflow.

Connect with others by browsing the [phonebook](#phonebook) to find people you may know on Realness. Add them to your network and view their content in your [feed](#thoughts), where you'll see a chronological stream of posters and statements from everyone you follow.

Stay organized by viewing upcoming [events](#events) and creating your own. When something moves you, reach out directly - there are no likes or comments here, just genuine connection through text messages to people you care about.

There are no likes, no friend counts, no comments. And the application is not playing engagement games with your mind. You text when your friends post something that moves you.

---

## Procreate

If you want to use your poster in Procreate You'll need to convert it to PSD with Affinity Designer or Adobe Illustrator. each realness vector exports as much information as possible. There are 5 value layers and a special cutouts layer created when you do. You have access to a tremendous amount of design options. in a small file optimized from the get go to be used creatively.

---

## Application Views

Time is organized into thoughts intervals of input that are grouped together. your realness updates at most 3 times a day meaning you must wait 8 hours between updates. It's okay though. you have everyone's phone number.

This is a service for people who want to trust each other and committed to the discipline and work to make that happen.

### Navigation

[Main home screen](/)

The navigation provides quick access to all major sections of the app. You'll find the camera for creating [posters](#posters), a writing interface for [statements](#statements), version information, help links, and account dialog access right from the main screen.

All navigation works offline, with camera access for poster creation and local statement storage. There's no tracking or analytics - everything stays on your device.

#### Settings

The settings Dialog is accessed from the bottom left on most screens of the app.

Here you can manage visual preferences like fill, stroke, emboss, and animate settings that control how [posters](#posters) are downloaded. You'll also find performance settings including FPS display and export options for Adobe and simple IDs.

All preferences are stored locally with no server-side sync, giving you complete control over your settings while working offline.

#### Sign-on

**Purpose**: User authentication and account setup

If you choose to sign in, you will show up in the [phonebook](#phonebook). People can message you via the phone number you signed in with. Realness is blind to search engines and has no tracking or advertising. It's a tool for reference that you can invite people you care about to use and share.

The sign-on process uses phone number authentication with name setup for new users. You have account cleanup options and integration with Firebase Auth, but with minimal server interaction - only for authentication. Your account data is managed locally, and you control your authentication with a clean slate option for privacy.

---

### Thoughts

**Purpose**: Timeline view of all content from you and your relations

The thoughts view shows a chronological feed of [posters](#posters) and [statements](#statements) from everyone you follow. You can enter fullscreen mode by pressing 'F' key, and the feed combines content from all your [relations](#relations) with real-time updates from local storage.

All content is stored locally and works completely offline. There are no server-side feed algorithms - you control what content appears in your timeline.

#### Profile

**Purpose**: Individual user profiles and content

Each profile displays the user's avatar and information alongside a chronological content timeline. You can send direct messages and download [posters](#posters), with everything organized by days for easy browsing.

Profile data is stored locally with content cached for offline viewing. There's no tracking of profile visits, and users control their own data completely.

---

### Posters

[Gallery](/posters) of your vector graphics and poster management

The posters view shows a grid display of all your vector graphics. You can add new posters through the camera or file picker, process entire directories of images in batch, and delete posters with a confirmation dialog. Each poster has an author menu for additional options.

Vector graphics are created locally with image processing happening in web workers. All poster data is stored locally with no cloud processing required.

#### Edit a poster

Poster editing and optimization with interactive pan & zoom

The edit view provides a full-screen SVG viewer with pan and zoom controls for vector optimization. You can save your changes and navigate back, with the interface tab-indexed for accessibility. The interactive pan & zoom feature lets you dive deep into your vector posters with intuitive touch and mouse controls.

**Pan & Zoom Features**:

The system uses true SVG zoom that manipulates the actual SVG viewBox for crisp rendering at all zoom levels from 50% to 300%. It works across all devices - desktop users can drag with the mouse and zoom with the wheel, mobile users get touch drag and pinch zoom, while tablets have full touch gesture support. Your view state is automatically saved to localStorage, with each poster maintaining its own zoom and pan state. The smart memory feature means your preferred view is automatically saved and restored when you return to [posters](#posters).

**User Experience Benefits**:

The enhanced exploration lets you zoom in to examine fine details and pan around large posters. The mobile-first design makes touch gestures feel natural, while the seamless workflow means you don't need to re-zoom when returning to posters. Everything stays crisp at any zoom level thanks to true SVG scaling with no quality loss.

All editing happens locally with vector optimization in web workers and view state persisted in localStorage. There's no server-side processing required.

---

### PhoneBook

**Purpose**: Directory of all users and sign-up

The phonebook lets you browse all users in the network and sign up new users. You have access to [relations](#relations) management and can discover people you might want to connect with.

The user directory is cached locally with a client-side sign-up process. There's no tracking of user discovery, and the phonebook works offline after the initial load.

#### Relations

**Purpose**: Manage your social connections

The relations view shows a list of people you follow with quick access back to the [phonebook](#phonebook). Each relation gets a profile card, and you can navigate directly to individual [profiles](#profile) from here.

Relations are stored locally with no server-side friend suggestions. You control your network completely, and everything works offline.

### Events

**Purpose**: Calendar and event management

The events view displays upcoming events from you and your [relations](#relations). You can create new events from [posters](#posters) and see everything in chronological order, with full integration into your poster workflow.

Events are stored locally with no server-side coordination. You control event visibility completely, and the calendar works offline.

### Statements

**Purpose**: A way to journal your thoughts you can add to events and or talk about anything

The statements interface lets you write and edit your thoughts with a chronological history view. Content is organized by day and integrates seamlessly with your [thoughts](#thoughts) feed.

All text is stored locally with no server-side content moderation. You control your statements completely, and everything works offline.

## Keyboard Shortcuts

All keyboard shortcuts are context-aware and automatically generated from the application's keymap configuration. For a complete, up-to-date reference of all available shortcuts, press `Ctrl+K` or `F1` from any view to see the available shortcuts for that context.

**Tip**: The keyboard shortcuts modal shows all available commands organized by context, with descriptions for each command.

# preferences

_Animation_ designed to bring posters into the room. turning this on will put your GPU to work. But the effect is fun colors swoosh and change swell and unplacable movements.
