# Animation Performance System

## Overview

Building a flexible animation system that adapts to different device capabilities, automatically throttling or pausing animations based on real-time FPS performance.

## Goals

- **Target FPS**: 24 FPS baseline
- **Adaptive Performance**: Automatically adjust animation complexity based on device capabilities
- **Smooth Transitions**: No jarring jumps when toggling animations on/off
- **Device Flexibility**: Work well on both high-end and low-end devices

## Implementation Progress

### ✅ Completed Features

#### 1. Animation Speed Control

- **Speed Options**: `fast`, `normal`, `slow`, `very_slow`, `glacial`
- **Preference-based**: Uses `animation_speed` preference (default: `normal`)
- **Static Values**: Coordinated animation start values with unanimated poster state

#### 2. FPS Integration

- **Real-time FPS**: Using `@vueuse/core` `useFps()` in as-animation component
- **Performance Monitoring**: Continuous FPS tracking and adaptive responses
- **Console Logging**: Detailed performance feedback and debugging

#### 3. Adaptive Logic Structure

```javascript
// Performance zones:
// FPS < 15:  Pause animations entirely
// FPS 15-24: Slow down significantly
// FPS ≥ 24:  Normal speed
```

#### 4. Animation Coordination

- **Static Values**: `static_stroke_opacity: 0.8`, `static_fill_opacity: 0.9`, `static_stroke_width: 0.33`
- **Smooth Transitions**: Animations start from same state as unanimated poster
- **No Jarring Jumps**: Coordinated start/stop states

### 🔄 Current Issues

#### 1. Pause/Resume Implementation

- **Problem**: SVG animation pausing not working correctly
- **Attempted Solutions**:
  - CSS `animation-play-state: paused` (doesn't work on SVG `<animate>`)
  - DOM removal with `v-if="!animations_paused"` (removes elements entirely)
  - SVG `begin="indefinite"` attribute (current approach)

#### 2. Performance Impact

- **Issue**: FPS not improving when animations are "paused"
- **Current State**: FPS remains at 2-3 despite pause attempts
- **Logs Show**: Old ratio calculations still running (41x, 22x slowdown)

#### 3. System Integration

- **Animation Adaptive**: Preference enabled but system not responding
- **Console Logs**: Old system logs still appearing, new pause logs not visible
- **FPS Detection**: Working (shows 2-3 FPS) but adaptive response not triggering

## Technical Details

### Files Modified

- `src/components/posters/as-animation.vue` - Main adaptive logic
- `src/utils/preference.js` - Animation preferences
- `src/components/viewbox.vue` - Animation status display
- `src/App.vue` - FPS tracking and preferences

### Key Components

```javascript
// Adaptive multiplier calculation
const adaptive_multiplier = computed(() => {
  if (current_fps < 15) {
    // Pause animations
    animations_paused.value = true
    pause_animations()
    return 1
  }
  // ... other logic
})

// Animation begin control
const animation_begin = computed(() => {
  if (animations_paused.value) return `indefinite`
  return `0s`
})
```

## Next Steps

### Immediate Tasks

1. **Debug Pause System**: Verify `animations_paused` state changes
2. **Check SVG Begin**: Ensure `begin="indefinite"` actually pauses animations
3. **Performance Testing**: Measure actual FPS improvement when paused
4. **Console Cleanup**: Remove old logging, add new pause/resume logs

### Future Enhancements

1. **Gradual Throttling**: More nuanced performance zones
2. **Animation Quality**: Reduce animation complexity vs. just pausing
3. **User Feedback**: Visual indicators of performance mode
4. **Device Detection**: Proactive performance settings based on device capabilities

## Testing Notes

- **Current FPS**: 2-3 (very low performance)
- **Target FPS**: 24
- **Expected Behavior**: Animations should pause when FPS < 15
- **Actual Behavior**: Animations still running, FPS not improving

## Questions for Tomorrow

1. Is the `animation_adaptive` preference actually enabled?
2. Are the new pause/resume functions being called?
3. Does `begin="indefinite"` actually pause SVG animations?
4. What's causing the persistent low FPS if not animations?
