# Realness <span>online</span>

## Overview

[Posters](#posters) and [Thoughts](#thoughts) are what you make with Realness. It's an Each poster is an SVG graphic that is small enough to embed on websites yet expressive enough for creative pursuites. Posters are designed to be flexible, they integrate into toolchains, or can be efficently embeded into websites without optimiztions.

Realness works best on a phone for when you want to take quick photos. it works great even with digital zoom. Walking around making posters a good time. You save it to your home screen. It's a fun way to play with composition or framing. Realness is a tool to spark your creative journeys.

from the [homepage](https://realness.online) click on the camera, take a picture, and Realness will create a super fun rotoscope vector graphic.

Multilayered your image is a digital paintbrush designed to to be endlessly usefull. Each photo has eighteen gradients for you to pull color from. Realness integrates right into Figma, Affinity, Procreate, or Adobe toolchains.

enabling EXIF, and Model Context Protocol integration will provide an elegent interfact for integrating realness into 3d worflows (blender first). With chat and audio integration on the way it's a powerful tool for a new age of creative work.

---

## What You Can Do

Start by [signing up](#sign-on) with your phone number and creating an avatar to join the community. Once you're in, you can begin creating [statements](#statements) that become trains of thought as you add to them over time.

Take pictures and develop them into [vector graphics](#posters) that you can use as posters - each one is a digital paintbrush with eighteen gradients to pull colors from. Download and share these posters with your creative workflow.

Connect with others by browsing the [phonebook](#phonebook) to find people you may know on Realness. Add them to your network and view their content in your [feed](#thoughts), where you'll see a chronological stream of posters and statements from everyone you follow.

View upcoming [events](#events); create your own. When something moves you, reach out directly - there are no likes or comments here, just genuine connection through animated posters and text messaging to people you care about.

Realness updates at eight-hour intervals.

You can sync Realness across all your devices. Take a picture on your phone and then open realness on your ipad and send it to Procreate (via affinity designer).

---

## Preferences

The settings Dialog is accessed from the bottom left on most screens of the app.

Here you can manage visual preferences like fill, stroke, emboss, and animate settings that control how [posters](#posters) are downloaded. You'll also find performance settings including FPS display and export options for Adobe and simple IDs.
<kbd>ctrl</kbd><kbd>.</kbd>
All preferences are stored locally with no server-side sync, giving you complete control over your settings while working offline.

_Animation_ designed to bring posters into the room. turning this on will put your GPU to work. But the effect is fun colors swoosh and change swell and unplacable movements.

## Keyboard Shortcuts

All keyboard shortcuts are context-aware and automatically generated from the application's keymap configuration. For a complete, up-to-date reference of all available shortcuts, press <kbd>ctrl</kbd> <kbd>K</kbd> from any view to see the available shortcuts for that context.

**Tip**: The keyboard shortcuts modal shows all available commands organized by context, with descriptions for each command.

---

## Navigation

[Main home screen](/)

The navigation provides quick access to all major sections of the app. You'll find the camera for creating [posters](#posters), a writing interface for [statements](#statements), version information, help links, and account dialog access right from the main screen.

All navigation works offline, with camera access for poster creation and local statement storage. There's no tracking or analytics - everything stays on your device.

---

## Posters

[Gallery](/posters) of your vector graphics and poster management

The posters view shows a grid display of all your vector graphics. You can add new posters through the camera or file picker, process entire directories of images in batch, and delete posters with a confirmation dialog. Each poster has an author menu for additional options.

Vector graphics are created locally with image processing happening in web workers. All poster data is stored locally with no cloud processing required.

The edit view provides a full-screen SVG viewer with pan and zoom controls for vector optimization. You can save your changes and navigate back, with the interface tab-indexed for accessibility. The interactive pan & zoom feature lets you dive deep into your vector posters with intuitive touch and mouse controls. Shift click or three finger tap a poster to toggle between filling the all available space and viewing the entire poster in your viewport.

**Pan & Zoom Features**:

The system uses true SVG zoom that manipulates the actual SVG viewBox for crisp rendering at all zoom levels from 50% to 300%. It works across all devices - desktop users can drag with the mouse and zoom with the wheel, mobile users get touch drag and pinch zoom, while tablets have full touch gesture support. Your view state is automatically saved to localStorage, with each poster maintaining its own zoom and pan state. The smart memory feature means your preferred view is automatically saved and restored when you return to [posters](#posters).

**User Experience Benefits**:

The enhanced exploration lets you zoom in to examine fine details and pan around large posters. The mobile-first design makes touch gestures feel natural, while the seamless workflow means you don't need to re-zoom when returning to posters. Everything stays crisp at any zoom level thanks to true SVG scaling with no quality loss.

All editing happens locally with vector optimization in web workers and view state persisted in localStorage. There's no server-side processing required.

---

## Statements

The statements interface lets you write and edit your thoughts. Content is organized by thoughts into days so that you can and integrates seamlessly with your [thoughts](#thoughts) feed.

Statements work offline. You don't have to sign in to make them, but they are shared once you [sign in](#sign-on)

---

## Thoughts

Time is organized into thoughts. for thirteen minutes after a poster is created or you make a statement your additional posters and thoughts will be added to this thought. each new poster resets the timer. so you can keep a thought going or just let it go.

You can view a timeline of your thoughts view of all content from you and your relations

The thoughts view shows a chronological feed of [posters](#posters) and [statements](#statements) from everyone you follow. You can enter fullscreen mode by pressing 'F' key, and the feed combines content from all your [relations](#relations) with real-time updates from local storage.

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

Relations are stored locally with no server-side friend suggestions. You control your network completely, and everything works offline.

---

# Integration

## Procreate

If you want to use your poster in Procreate You'll need to convert it to PSD with Affinity Designer or Adobe Illustrator. each realness vector exports as much information as possible. There are 5 value layers and a special cutouts layer created when you do. You have access to a tremendous amount of design options. in a small file optimized from the get go to be used creatively.
