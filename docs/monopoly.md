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
