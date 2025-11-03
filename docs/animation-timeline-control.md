# Animation Timeline Control

## Current Implementation

We've implemented a foundation for precise animation control that fundamentally changes how users interact with animated SVG posters:

### Core Features
- **Always-rendered animations**: Animation elements exist in DOM but controlled via `pauseAnimations()`/`unpauseAnimations()`
- **Keyboard scrubbing**: Arrow keys move through animation timeline
  - Left/Right: 0.5s steps
  - Shift + Left/Right: 10s steps
  - Momentum: Repeated presses increase step size up to 6x
- **Timeline display**: FPS component shows current position in animation cycle when paused
- **Direct DOM download**: Downloaded SVG captures exact frame shown on screen

### Key Insight
Since animations are paused (not removed), the DOM reflects the precise state at any moment. Downloads capture exactly what's visible - no recalculation needed.

## Future Enhancements

### Timestamp Bookmarks
Allow users to save specific moments in the animation cycle:

- **Save current timestamp**: Store animation time as bookmark
- **Named bookmarks**: Label interesting moments ("dawn", "peak energy", etc)
- **Quick jump**: Button/keyboard shortcuts to saved timestamps
- **Persistence**: Store bookmarks in localStorage or user profile
- **Share timestamps**: URL params like `?t=42.5s` to load at specific time

### Preset Keyframes
Pre-defined moments of interest in each animation:

- **Auto-detected peaks**: Algorithm finds moments of visual interest
  - Maximum gradient separation
  - Peak opacity variations
  - Unique compositional arrangements
- **Artist-defined**: Vector authors can embed suggested keyframes
- **Thumbnail preview**: Visual preview of each keyframe
- **Keyboard navigation**: Number keys 1-9 to jump to presets

### Timeline Scrubber UI
Visual timeline control (optional, preference-based):

- **Progress bar**: Visual representation of animation cycle
- **Drag to scrub**: Mouse/touch scrubbing through timeline
- **Keyframe markers**: Visual indicators of bookmarks/presets
- **Loop visualization**: Show where different animation cycles overlap
- **Playback speed control**: 0.5x, 1x, 2x speed options

### Enhanced Keyboard Controls
Extend the momentum system:

- **Home/End**: Jump to start/end of cycle
- **Page Up/Down**: Jump by larger increments (30s?)
- **Number keys**: Quick jump to percentage (1=10%, 2=20%, etc)
- **Space bar**: Toggle play/pause (already have via preference)
- **Bracket keys [ ]**: Frame-by-frame (0.1s steps)

### Animation State Export
Save not just the visual but the entire animation state:

- **State JSON**: Export current time + all preference settings
- **Restore state**: Import to recreate exact configuration
- **State presets**: Save favorite configurations
- **Version control**: Track changes to saved states

### Multi-Vector Synchronization
When viewing multiple posters:

- **Sync timelines**: All animations at same relative position
- **Offset control**: Stagger animation starts
- **Group scrubbing**: Scrub all visible animations together

## Technical Considerations

### Performance
- Timeline scrubbing is instant (no DOM manipulation)
- Momentum system prevents excessive updates
- RAF-based time display doesn't impact animation performance

### Accessibility
- All keyboard controls should have screen reader announcements
- Timeline position should be announced when changed
- Visual timeline UI must support keyboard navigation

### Storage
- Bookmarks per vector ID
- Consider storage quota for heavy users
- Cloud sync for signed-in users

### URL Structure
- `?anim=paused&t=42.5` - Load paused at 42.5s
- `?anim=playing&speed=2` - Load playing at 2x speed
- `?bookmark=dawn` - Load at named bookmark

## Implementation Priority

1. **Phase 1** (Current): Basic scrubbing + display ✓
2. **Phase 2**: Bookmark save/restore
3. **Phase 3**: Preset keyframes system
4. **Phase 4**: Visual timeline UI
5. **Phase 5**: Multi-vector sync

## Open Questions

- Should bookmarks be vector-specific or global timestamps?
- How many bookmarks per user before cleanup needed?
- Should timeline UI be always visible or toggle-able?
- Do we need undo/redo for timeline navigation?
- Should we track "interesting moments" via analytics to suggest popular timestamps?