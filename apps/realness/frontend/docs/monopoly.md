# Monopoly

Paper trail: platform rules that tax the open web and PWAs - especially where native App Store apps get a simpler path.

Realness lives outside the shopping mall. These entries document what we hit, what we shipped, and what we cannot fix in code.

---

## Entries

### 2026-05-25 - iOS motion permission for 3D gyro (PWA)

**Context**

- 3D poster tilt uses `DeviceOrientationEvent` (beta/gamma).
- On iPhone Safari and home-screen PWAs, Apple requires `DeviceOrientationEvent.requestPermission()` inside a user gesture.
- Denial is sticky: no web API to reset it. Recovery is via Settings or deleting website data / reinstalling the PWA.
- A refactor (`8bc197d1`) added module-level permission state, early requests outside gestures, and UI that showed "motion access denied" - gyro regressed.
- Product stance: Realness is a PWA parallel to app stores, not inside them. This friction is platform policy, not a security gap we can close.

**What we ship**

| Step                     | Behavior                                                             |
| ------------------------ | -------------------------------------------------------------------- |
| User turns 3D on         | Gyro arms on active poster canvases                                  |
| User touches a 3D poster | `request_motion_permission()` in that gesture, then iOS Allow prompt |
| Permission granted       | Gyro tilt works; no extra settings toggle                            |
| No permission API        | Android / desktop: gyro enables on canvas mount                      |
| Denied                   | Gyro stays off until user fixes Safari / site permission             |

**Code**

- `src/3d/engine/bind-device-orientation.js` - permission + gyro bind
- `src/3d/engine/create-input.js` - calls `bind_device_orientation` per viewer canvas

**Cross-browser (within spec)**

| Platform         | Permission prompt        | Gyro without extra tap |
| ---------------- | ------------------------ | ---------------------- |
| iOS Safari / PWA | First touch on 3D poster | After Allow            |
| Android Chrome   | Usually none             | Yes, on canvas mount   |
| Desktop          | Usually none             | Yes, on canvas mount   |

Uses standard APIs only: `DeviceOrientationEvent.requestPermission` when present, `deviceorientation` + `orientationchange`, screen angle from `screen.orientation` or `window.orientation`. No native bridge. No app-store-only APIs.

**How compromised this is**

The gyro experience on iOS is fundamentally broken compared to native apps:

- **Native apps**: Gyro works immediately, no permission prompt
- **iOS PWA**: Must touch screen first, then permission prompt, sticky denial with no code-level recovery
- **User confusion**: "Why doesn't tilt work?" → touch poster → "Allow motion access?" → confusion about what this means
- **Recovery complexity**: Requires 4-step process through iOS Settings if user denies once
- **Fragile UX**: One wrong tap breaks the feature until manual Settings intervention

This creates a second-class experience where the web version feels broken compared to what users expect from mobile apps.

**Out of scope (platform)**

- Programmatic permission reset after Deny
- Native-parity gyro in iOS PWA without user gesture
- Hiding Safari website-data steps from users who already denied once

**Recovery (user)**

1. Remove PWA from home screen
2. Settings → Safari → Advanced → Website Data → delete site
3. Settings → Safari → Motion & Orientation Access → on
4. Reinstall PWA, turn 3D on, touch a poster, tap Allow

---

### 2026-05-31 - PWA icon platform quirks

**Context**

- One asset pair: `192.png` and `512.png` from `scripts/generate-icons.js` (`#2c2c26` fill, ~10% inset)
- Manifest: `purpose: "any maskable"` on both sizes
- iOS ignores manifest icons; `index.html` points `apple-touch-icon` at the same `192.png`
- iOS still applies its own rounding and padding; opaque background avoids the white tile

**Code**

- `scripts/generate-icons.js`
- `index.html` - `apple-touch-icon`
- `vite.config.js` - manifest `icons`

**Out of scope (platform)**

- Identical icon framing on every OS
- Disabling iOS automatic icon treatment

---

### 2026-07-02 - iOS strips EXIF from the Photos picker (feature removed 2026-07-03)

**Context**

- We built optional EXIF capture (`include_exif`): read camera/date/GPS/lens from the original file at capture, persist into the poster index, show it on the poster in Info mode with a rule-of-thirds subject-area overlay.
- The wall: on iOS Safari, a photo from the **Photos library or the camera button** does not arrive as the original. iOS re-exports a **sanitized copy** named `image.jpg`, stripping camera, date, and GPS - regardless of format (HEIC "High Efficiency" or JPEG "Most Compatible" strip identically). Only the **Files app** hands over the untouched original (`IMG_0225.HEIC`) with full EXIF.
- OS-level privacy re-export: by the time JS sees the `File`, the tags are gone. No parser recovers bytes that aren't there.

**Evidence (measured)**

| Source (same iPhone photo) | File we receive         | EXIF found                                                              |
| -------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| Photos picker (HEIC)       | `image.jpg`, re-encoded | structural only (Orientation, resolution), `gps=[]`                     |
| Photos picker (JPEG)       | `image.jpg`, re-encoded | structural only, `gps=[]`                                               |
| Files app (original)       | `IMG_0225.HEIC`         | 25 fields: Make/Model, DateTimeOriginal, lens, GPS lat/lng/alt, bearing |

**Decision**

- **Removed the feature.** For the common iOS path (Photos picker) it delivers nothing; a metadata surface that only works from Files / desktop / Android isn't worth the surface area. All EXIF code (`utils/exif.js`, `as-poster-exif.vue`, `account/as-exif.vue`, `include_exif`, capture in `vectorize.js`) was deleted.

**Future path - capture at the source**

- An in-app camera via `getUserMedia` / `MediaDevices` would capture metadata directly, sidestepping the Photos-picker re-export entirely: `navigator.geolocation` (GPS), `DeviceOrientationEvent` (compass bearing), a capture timestamp, and `MediaStreamTrack.getSettings()` (resolution/facing).
- Web camera APIs do **not** expose make/model/lens/aperture/ISO - but the location, orientation, and time that matter most are all obtainable live. This is the reason to own the camera rather than accept the system picker.

**Out of scope (platform)**

- Recovering camera/date/GPS that iOS removed before handing us the file
- Native-parity EXIF from the iOS Photos picker

---
